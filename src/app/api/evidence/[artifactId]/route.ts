import { auth } from "@clerk/nextjs/server";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";

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
  const upstreamLength = upstream.headers.get("content-length");
  if (upstreamLength) headers.set("Content-Length", upstreamLength);

  return new NextResponse(upstream.stream, { status: 200, headers });
}
