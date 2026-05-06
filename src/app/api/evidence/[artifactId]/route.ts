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
