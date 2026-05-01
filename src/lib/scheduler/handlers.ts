/**
 * Task handler registry. Side-effect import: importing this module
 * registers every handler the scheduler can dispatch.
 *
 * Keep handlers SMALL — defer heavy work to dedicated lib modules.
 */

import { registerTaskHandler } from "./index";
import { sendCompliancePulse } from "@/lib/email/compliance-pulse";

registerTaskHandler("compliance_pulse.weekly", async (ctx) => {
  await sendCompliancePulse({ organizationId: ctx.organizationId });
  // Reschedule for next Monday 09:00 local UTC.
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + ((1 + 7 - now.getUTCDay()) % 7 || 7));
  next.setUTCHours(13, 0, 0, 0); // 09:00 ET-ish
  return { status: "ok", nextRunAt: next };
});

registerTaskHandler("connector.refresh", async () => {
  // Skeleton: connector token refresh is implemented per-provider in a
  // follow-up. The scheduler row is already wired so we can ship it
  // once the refresh logic lands. Re-run weekly until then.
  const next = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { status: "skip", nextRunAt: next, notes: "refresh handler pending" };
});

registerTaskHandler("monitor.run_checks", async () => {
  // Skeleton: continuous-monitoring evaluator. See plans/cmmc-l1-pivot.md.
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { status: "skip", nextRunAt: next, notes: "monitor handler pending" };
});
