import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/admin-auth";
import { initDb } from "@/lib/db";
import { runDiscovery } from "@/lib/outbound/discovery-pipeline";

/**
 * Admin discovery endpoint — agent-mode.
 *
 * Caller says "find me N qualified leads" and the pipeline figures out
 * the rest (date range, NAICS, amounts, Hunter cap). Smart defaults live
 * in `discovery-pipeline.ts` so cron + admin button stay in sync.
 *
 * Body: { count?: number }   default 10, hard-capped at 50 internally.
 */
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  await requireAdmin();
  await initDb();

  let body: { count?: unknown } = {};
  try {
    body = (await req.json()) as { count?: unknown };
  } catch {
    // empty body is fine
  }
  const target =
    typeof body.count === "number" && Number.isFinite(body.count)
      ? Math.max(1, Math.min(Math.floor(body.count), 50))
      : 10;

  const result = await runDiscovery(target, "admin");
  return NextResponse.json(result);
}
