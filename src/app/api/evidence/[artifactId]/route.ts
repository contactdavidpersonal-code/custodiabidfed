import { auth } from "@clerk/nextjs/server";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { tryDecryptBytes } from "@/lib/security/field-encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated evidence proxy.
 *
 * Every evidence read goes through here so:
 *   - Custodia enforces tenant isolation on every byte returned, not just
 *     at upload/list time. The bare Vercel Blob URL is a server-side secret
 *     and is never exposed to the browser, referrer headers, history, or
 *     screen-shares.
 *   - Each access produces an `evidence.viewed` audit row (CMMC L1 SI.L1
 *     evidentiary trail).
 *   - Deleting the artifact row removes access immediately even though
 *     the underlying blob URL would otherwise remain reachable.
 *
 * The blob itself is stored unguessable (random suffix) but is technically
 * publicly fetchable if the URL leaks; this proxy is the access-control
 * boundary that makes that fact safe.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Per-user mass-exfil throttle. 300 reads/hr accommodates a thorough
  // assessor flipping through every artifact in a cycle (CMMC L1 ships
  // ~30 artifacts × inspection passes) while denying an attacker who has
  // taken over a session the ability to scrape every evidence file in
  // bulk before alerting trips. Counts every byte read at this proxy.
  const evidenceRl = await checkRateLimit(
    rateLimitKey({ scope: "evidence-read", userId }),
    { max: 300, windowSec: 3600 },
  );
  if (!evidenceRl.allowed) {
    await recordAuditEvent({
      action: "rate_limit.exceeded",
      userId,
      resourceType: "evidence_artifact",
      metadata: { scope: "evidence-read", retryAfterSec: evidenceRl.retryAfterSec },
    });
    return rateLimitResponse(evidenceRl) as NextResponse;
  }

  const { artifactId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, control_id, filename, blob_url, mime_type, size_bytes
    FROM evidence_artifacts
    WHERE id = ${artifactId}
    LIMIT 1
  `) as Array<{
    id: string;
    assessment_id: string;
    control_id: string;
    filename: string;
    blob_url: string;
    mime_type: string | null;
    size_bytes: number | null;
  }>;

  if (rows.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  const artifact = rows[0];

  // Tenant check — only a member of the owning org can pull these bytes.
  const ctx = await getAssessmentForUser(artifact.assessment_id, userId);
  if (!ctx) {
    const auditCtx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "auth.unauthorized",
      userId,
      resourceType: "evidence_artifact",
      resourceId: artifactId,
      ip: auditCtx.ip,
      userAgent: auditCtx.userAgent,
      metadata: { reason: "tenant_mismatch" },
    });
    // Mirror "not found" so we don't leak existence cross-tenant.
    return new NextResponse("Not found", { status: 404 });
  }

  // Server-side fetch via the Vercel Blob SDK. The store is configured for
  // private access, so we use `get()` (which sends the BLOB_READ_WRITE_TOKEN
  // automatically) instead of a raw `fetch()` on the URL. The blob URL never
  // leaves this process.
  let upstream: Awaited<ReturnType<typeof get>>;
  try {
    upstream = await get(artifact.blob_url, {
      access: "private",
      useCache: false,
    });
  } catch (err) {
    console.error(`[evidence-proxy] get() failed for ${artifactId}`, err);
    return new NextResponse("Evidence unavailable", { status: 502 });
  }
  if (!upstream || upstream.statusCode !== 200 || !upstream.stream) {
    console.error(
      `[evidence-proxy] no stream for ${artifactId} (status=${upstream?.statusCode ?? "null"})`,
    );
    return new NextResponse("Evidence unavailable", { status: 502 });
  }

  const auditCtx = auditContextFromRequest(req);
  await recordAuditEvent({
    action: "evidence.viewed",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "evidence_artifact",
    resourceId: artifactId,
    ip: auditCtx.ip,
    userAgent: auditCtx.userAgent,
    metadata: {
      assessmentId: artifact.assessment_id,
      controlId: artifact.control_id,
      filename: artifact.filename,
    },
  });

  // Tier 1 zero-trust: bytes on disk are AES-256-GCM-encrypted with AAD
  // bound to (orgId, evidence:assessmentId:controlId). Buffer the upstream
  // body and decrypt before returning. Streaming pass-through is sacrificed
  // here, but evidence files are bounded to ~25MB by upload limits which
  // fits comfortably in lambda memory. Legacy plaintext blobs (uploaded
  // before this rollout) pass through unchanged via tryDecryptBytes().
  let plainBytes: Buffer;
  try {
    const reader = upstream.stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const HARD_CAP = 32 * 1024 * 1024;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > HARD_CAP) {
        return new NextResponse("Evidence too large", { status: 502 });
      }
      chunks.push(value);
    }
    const cipherBuf = Buffer.concat(chunks.map((c) => Buffer.from(c)), total);
    plainBytes = await tryDecryptBytes(cipherBuf, {
      organizationId: ctx.organization.id,
      field: `evidence:${artifact.assessment_id}:${artifact.control_id}`,
    });
  } catch (err) {
    console.error(`[evidence-proxy] decrypt failed for ${artifactId}`, err);
    return new NextResponse("Evidence unavailable", { status: 502 });
  }

  // Sanitize the filename for the Content-Disposition header — RFC 6266
  // disallows raw quotes/CR/LF and we already constrain on upload, but
  // belt-and-suspenders here.
  const safeFilename = artifact.filename.replace(/[\r\n"\\]+/g, "_");

  // Markdown is our authoring format for Charlie-drafted procedures and
  // narratives — Charlie writes it reliably, it stays small, and it
  // diffs cleanly. But raw `.md` opens as plain text in the browser,
  // which looks broken to a user (and to an assessor) clicking on the
  // artifact. So we serve markdown bytes three ways from the same row:
  //
  //   default       — raw bytes (legacy behavior; lets curl/scripts work)
  //   ?format=html  — markdown rendered to a styled, printable HTML page
  //   ?format=pdf   — markdown piped through the rhetorich-themed PDF
  //                   renderer so the assessor sees a polished deliverable
  //
  // The HTML output is locked down with a strict CSP (no scripts of any
  // kind) because the body content was authored by an LLM and could in
  // principle contain prompt-injected raw HTML. CSP makes that safe to
  // render in the user's tab.
  const isMarkdown =
    artifact.mime_type === "text/markdown" ||
    artifact.filename.toLowerCase().endsWith(".md");
  const format = new URL(req.url).searchParams.get("format");

  if (isMarkdown && format === "html") {
    const { marked } = await import("marked");
    const md = plainBytes.toString("utf8");
    const bodyHtml = await marked.parse(md, { gfm: true, breaks: false });
    const titleFromFilename = artifact.filename
      .replace(/\.md$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const pageHtml = renderDeliverableHtml({
      title: titleFromFilename,
      organizationName: ctx.organization.name,
      controlId: artifact.control_id,
      artifactId: artifact.id,
      bodyHtml: String(bodyHtml),
    });
    const buf = Buffer.from(pageHtml, "utf8");
    const h = new Headers();
    h.set("Content-Type", "text/html; charset=utf-8");
    h.set(
      "Content-Disposition",
      `inline; filename="${safeFilename.replace(/\.md$/i, ".html")}"`,
    );
    h.set("Cache-Control", "private, no-store");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "no-referrer");
    h.set("X-Frame-Options", "DENY");
    // No scripts, no fetches, no embeds. Inline styles only.
    h.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    h.set("Content-Length", String(buf.length));
    return new NextResponse(new Uint8Array(buf), { status: 200, headers: h });
  }

  if (isMarkdown && format === "pdf") {
    const { renderDeliverablePdf } = await import("@/lib/cmmc/pdf-deliverable");
    const md = plainBytes.toString("utf8");
    const titleFromFilename = artifact.filename
      .replace(/\.md$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const pdfBuf = await renderDeliverablePdf({
      meta: {
        organizationName: ctx.organization.name,
        title: titleFromFilename,
        controlId: artifact.control_id,
        effectiveDate: new Date(),
        documentType: "Evidence deliverable",
      },
      body: md,
    });
    const h = new Headers();
    h.set("Content-Type", "application/pdf");
    h.set(
      "Content-Disposition",
      `attachment; filename="${safeFilename.replace(/\.md$/i, ".pdf")}"`,
    );
    h.set("Cache-Control", "private, no-store");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "no-referrer");
    h.set("X-Frame-Options", "DENY");
    h.set("Content-Length", String(pdfBuf.length));
    return new NextResponse(new Uint8Array(pdfBuf), { status: 200, headers: h });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    artifact.mime_type || "application/octet-stream",
  );
  // `inline` so PDFs/images render in-tab; users can still download.
  headers.set(
    "Content-Disposition",
    `inline; filename="${safeFilename}"`,
  );
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  // Belt: prevent the proxied response from being framed.
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Length", String(plainBytes.length));

  return new NextResponse(new Uint8Array(plainBytes), { status: 200, headers });
}

/**
 * Wrap marked() output in a printable, rhetorich-adjacent letterhead so
 * a click on a Charlie-drafted `.md` opens as a real-looking document
 * (cream paper, navy ink, gold rule) rather than raw markdown text.
 *
 * Inline styles only — the response is served with a strict CSP that
 * blocks scripts and external resources, which is what makes it safe
 * to render LLM-authored content directly.
 */
function renderDeliverableHtml(args: {
  title: string;
  organizationName: string;
  controlId: string;
  artifactId: string;
  bodyHtml: string;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(args.title)} — ${esc(args.controlId)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; background: #faf7f2; line-height: 1.6; font-size: 11.5pt; }
  .sheet { max-width: 7in; margin: 0.5in auto; padding: 0 0.5in 1in; }
  header.bar { border-bottom: 1px solid #c9bfa8; padding-bottom: 0.5rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9pt; letter-spacing: 0.14em; text-transform: uppercase; color: #0b1f3a; }
  .actions a { color: #0b1f3a; text-decoration: none; border: 1px solid #0b1f3a; padding: 5px 12px; font-weight: 700; letter-spacing: 0.1em; }
  .actions a:hover { background: #0b1f3a; color: #faf7f2; }
  h1.doc-title { font-size: 24pt; font-weight: 700; margin: 0 0 0.25rem; color: #0b1f3a; line-height: 1.2; }
  .doc-sub { font-style: italic; color: #5e5246; margin: 0 0 1.25rem; }
  dl.meta { background: #f3ede2; border-left: 3px solid #b8924a; padding: 0.75rem 1rem; margin: 0 0 1.5rem; font-family: 'Helvetica Neue', Arial, sans-serif; display: grid; grid-template-columns: max-content 1fr; column-gap: 1rem; row-gap: 0.35rem; font-size: 10pt; }
  dl.meta dt { font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #5e5246; font-size: 9pt; align-self: center; }
  dl.meta dd { margin: 0; color: #0b1f3a; }
  .body h1, .body h2, .body h3, .body h4 { color: #0b1f3a; font-weight: 700; margin: 1.5rem 0 0.5rem; line-height: 1.3; }
  .body h1 { font-size: 17pt; border-bottom: 1px solid #c9bfa8; padding-bottom: 0.25rem; }
  .body h2 { font-size: 14pt; }
  .body h3 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em; color: #3e5b7e; }
  .body h4 { font-size: 11pt; font-style: italic; color: #3e5b7e; }
  .body p { margin: 0 0 0.85rem; }
  .body ul, .body ol { margin: 0 0 0.85rem; padding-left: 1.5rem; }
  .body li { margin-bottom: 0.3rem; }
  .body strong { color: #0b1f3a; }
  .body em { color: #3e5b7e; }
  .body a { color: #0b1f3a; text-decoration: underline; }
  .body blockquote { margin: 0 0 0.85rem; padding: 0.5rem 1rem; border-left: 3px solid #c9bfa8; background: #f3ede2; color: #3e5b7e; font-style: italic; }
  .body code { background: #f3ede2; padding: 1px 5px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 10pt; }
  .body pre { background: #f3ede2; padding: 0.75rem 1rem; overflow-x: auto; font-size: 10pt; border-left: 3px solid #c9bfa8; }
  .body pre code { background: transparent; padding: 0; }
  .body table { border-collapse: collapse; margin: 0 0 1rem; width: 100%; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; }
  .body th, .body td { border: 1px solid #c9bfa8; padding: 0.4rem 0.7rem; text-align: left; }
  .body th { background: #f3ede2; font-weight: 700; color: #0b1f3a; letter-spacing: 0.04em; }
  .body hr { border: none; border-top: 1px solid #c9bfa8; margin: 1.5rem 0; }
  footer.bar { margin-top: 2.5rem; padding-top: 0.75rem; border-top: 1px solid #c9bfa8; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 8pt; color: #5e5246; letter-spacing: 0.08em; text-transform: uppercase; display: flex; justify-content: space-between; }
  @media print {
    .actions { display: none; }
    body { background: #fff; }
    .sheet { margin: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
<div class="sheet">
  <header class="bar">
    <div>${esc(args.organizationName)} · Custodia BidFedCMMC</div>
    <div class="actions"><a href="/api/evidence/${esc(args.artifactId)}?format=pdf">Download PDF</a></div>
  </header>
  <h1 class="doc-title">${esc(args.title)}</h1>
  <p class="doc-sub">Evidence deliverable — ${esc(args.controlId)}</p>
  <dl class="meta">
    <dt>Control</dt><dd>${esc(args.controlId)}</dd>
    <dt>Organization</dt><dd>${esc(args.organizationName)}</dd>
    <dt>Effective</dt><dd>${esc(today)}</dd>
  </dl>
  <div class="body">
${args.bodyHtml}
  </div>
  <footer class="bar">
    <div>Custodia · BidFedCMMC</div>
    <div>Generated ${esc(today)}</div>
  </footer>
</div>
</body>
</html>`;
}
