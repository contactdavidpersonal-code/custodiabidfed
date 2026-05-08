/**
 * Manual connector ingest. For artifact kinds where Custodia does not yet
 * have a live API fetcher (external sharing, public shares, patch
 * compliance, Defender inventory), an MSP can paste the raw export
 * (JSON or CSV) here and the same auto-mapping + provenance flow runs.
 *
 * Body (application/json):
 *   {
 *     assessmentId: string (uuid),
 *     kind: ArtifactKind,
 *     payload: unknown            // arbitrary JSON; canonicalised before hashing
 *   }
 *
 * Or (text/csv | application/octet-stream):
 *   raw bytes; URL params: ?assessmentId=...&kind=...
 *
 * The provider tag stamped on the artifact is "manual_ingest" so an
 * assessor can clearly distinguish it from a live API pull. data_hash is
 * recorded the same way; tampering is still detectable.
 */

import { NextResponse } from "next/server";
import { getActiveOrgFromAuth } from "@/lib/assessment";
import {
  canonicalJsonBytes,
  isArtifactKind,
  recordConnectorEvidence,
  startConnectorRun,
  completeConnectorRun,
} from "@/lib/connectors/auto-map";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  const org = await getActiveOrgFromAuth();
  if (!org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  let assessmentId: string;
  let kind: string;
  let bytes: Buffer;
  let rowCount: number | undefined;

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    assessmentId = String(b.assessmentId ?? "");
    kind = String(b.kind ?? "");
    if (!("payload" in b)) {
      return NextResponse.json({ error: "payload required" }, { status: 400 });
    }
    bytes = canonicalJsonBytes(b.payload);
    if (Array.isArray(b.payload)) rowCount = b.payload.length;
  } else {
    // Treat as raw bytes (CSV, etc.). Take params from the query string.
    assessmentId = url.searchParams.get("assessmentId") ?? "";
    kind = url.searchParams.get("kind") ?? "";
    bytes = Buffer.from(await req.arrayBuffer());
  }

  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
  }
  if (!isArtifactKind(kind)) {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }
  if (bytes.length === 0) {
    return NextResponse.json({ error: "empty payload" }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  // Tenant guard.
  const sql = getSql();
  const rows = (await sql`
    SELECT 1 FROM assessments
    WHERE id = ${assessmentId}::uuid
      AND organization_id = ${org.id}::uuid
    LIMIT 1
  `) as Array<unknown>;
  if (rows.length === 0) {
    return NextResponse.json({ error: "assessment not found" }, { status: 404 });
  }

  const runId = await startConnectorRun({
    organizationId: org.id,
    provider: "manual_ingest",
    kind,
    triggeredBy: "manual",
  });
  try {
    const result = await recordConnectorEvidence({
      organizationId: org.id,
      assessmentId,
      provider: "manual_ingest",
      kind,
      payloadBytes: bytes,
      runId,
      rowCount,
      contentType: contentType.includes("csv")
        ? "text/csv"
        : contentType.includes("json")
          ? "application/json"
          : "application/octet-stream",
    });
    await completeConnectorRun({
      runId,
      status: "success",
      rowCount,
      rawHash: result.dataHash,
    });
    return NextResponse.json({
      ok: true,
      artifactId: result.artifactId,
      dataHash: result.dataHash,
      practicesTagged: result.practicesTagged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeConnectorRun({ runId, status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
