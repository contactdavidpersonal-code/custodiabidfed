/**
 * Manually trigger a connector sync for the active org. POST { assessmentId }.
 * Returns the per-pipeline outcomes so the UI can render success/failure
 * banners. Org-scoped: an attacker cannot supply someone else's assessmentId.
 */

import { NextResponse } from "next/server";
import { getActiveOrgFromAuth } from "@/lib/assessment";
import { runConnectorSync } from "@/lib/connectors/sync";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const org = await getActiveOrgFromAuth();
  if (!org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const assessmentId =
    body && typeof body === "object" && "assessmentId" in body
      ? String((body as { assessmentId: unknown }).assessmentId)
      : "";
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
  }

  // Tenant guard: assessment must belong to the active org.
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

  const outcomes = await runConnectorSync({
    organizationId: org.id,
    assessmentId,
    triggeredBy: "manual",
  });
  return NextResponse.json({ outcomes });
}
