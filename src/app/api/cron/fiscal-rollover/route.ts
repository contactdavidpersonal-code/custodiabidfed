import { NextResponse } from "next/server";
import { createAssessmentForOrg } from "@/lib/assessment";
import { initDb } from "@/lib/db";
import {
  defaultCycleLabel,
  fiscalYearOf,
  orgsNeedingRollover,
} from "@/lib/fiscal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron that ensures every onboarded org has an assessment for the
 * current fiscal year. Idempotent — safe to run multiple times per day.
 * Protected by the standard Vercel `CRON_SECRET` bearer-token convention.
 */
export async function GET(req: Request) {
  const authed = verifyCronSecret(req);
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();

  const fy = fiscalYearOf();
  const orgs = await orgsNeedingRollover(fy);

  const created: Array<{ organization_id: string; assessment_id: string }> = [];
  for (const o of orgs) {
    try {
      const assessment = await createAssessmentForOrg(
        o.organization_id,
        defaultCycleLabel(fy),
        "cmmc_l1",
        fy,
      );
      created.push({
        organization_id: o.organization_id,
        assessment_id: assessment.id,
      });
    } catch (err) {
      console.error(
        `[fiscal-rollover] failed for org ${o.organization_id}:`,
        err,
      );
    }
  }

  return NextResponse.json({ fiscal_year: fy, rolled_over: created });
}

function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — allow in dev so we can exercise the endpoint
    // locally. Production MUST set CRON_SECRET.
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}
