import { NextResponse } from "next/server";
import {
  createAssessmentForOrg,
  createAssessmentWithCarryForward,
} from "@/lib/assessment";
import { initDb } from "@/lib/db";
import {
  defaultCycleLabel,
  fiscalYearOf,
  orgsNeedingRollover,
} from "@/lib/fiscal";
import { auditContextFromRequest, recordAuditEvent } from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

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
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "fiscal-rollover",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await initDb();

  const fy = fiscalYearOf();
  const orgs = await orgsNeedingRollover(fy);

  const created: Array<{
    organization_id: string;
    assessment_id: string;
    carried_from: string | null;
  }> = [];
  for (const o of orgs) {
    try {
      const assessment = o.prior_assessment_id
        ? await createAssessmentWithCarryForward(
            o.organization_id,
            defaultCycleLabel(fy),
            "cmmc_l1",
            fy,
            o.prior_assessment_id,
          )
        : await createAssessmentForOrg(
            o.organization_id,
            defaultCycleLabel(fy),
            "cmmc_l1",
            fy,
          );
      created.push({
        organization_id: o.organization_id,
        assessment_id: assessment.id,
        carried_from: o.prior_assessment_id,
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
