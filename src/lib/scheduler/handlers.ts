/**
 * Task handler registry. Side-effect import: importing this module
 * registers every handler the scheduler can dispatch.
 *
 * Keep handlers SMALL — defer heavy work to dedicated lib modules.
 */

import { registerTaskHandler } from "./index";
import { sendCompliancePulse } from "@/lib/email/compliance-pulse";
import { runConnectorSync } from "@/lib/connectors/sync";
import { getSql } from "@/lib/db";

registerTaskHandler("compliance_pulse.weekly", async (ctx) => {
  await sendCompliancePulse({ organizationId: ctx.organizationId });
  // Reschedule for next Monday 09:00 local UTC.
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + ((1 + 7 - now.getUTCDay()) % 7 || 7));
  next.setUTCHours(13, 0, 0, 0); // 09:00 ET-ish
  return { status: "ok", nextRunAt: next };
});

registerTaskHandler("connector.refresh", async (ctx) => {
  // Pick the most recent in-progress assessment for the org. If there
  // is none yet (org just signed up, hasn't started anything), skip and
  // retry tomorrow — there's no sensible target to attach evidence to.
  const sql = getSql();
  const rows = (await sql`
    SELECT id FROM assessments
    WHERE organization_id = ${ctx.organizationId}::uuid
      AND submitted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ id: string }>;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (rows.length === 0) {
    return {
      status: "skip",
      nextRunAt: tomorrow,
      notes: "no active assessment",
    };
  }
  const outcomes = await runConnectorSync({
    organizationId: ctx.organizationId,
    assessmentId: rows[0].id,
    triggeredBy: "scheduler",
  });
  const ok = outcomes.filter((o) => o.status === "ok").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  // Re-run nightly while at least one provider is connected; otherwise
  // the next outcome will be all-skipped and we just keep no-op'ing.
  return {
    status: failed > 0 && ok === 0 ? "retry" : "ok",
    nextRunAt: tomorrow,
    notes: `connector sync: ${ok} ok, ${failed} failed, ${outcomes.length - ok - failed} skipped`,
  };
});

registerTaskHandler("monitor.run_checks", async () => {
  // Skeleton: continuous-monitoring evaluator. See plans/cmmc-l1-pivot.md.
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { status: "skip", nextRunAt: next, notes: "monitor handler pending" };
});
