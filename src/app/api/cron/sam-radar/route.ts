import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  fetchOpportunitiesForOrg,
  listRadarTargets,
  markOpportunitiesDigested,
  persistOpportunities,
  SamApiKeyError,
} from "@/lib/sam-radar";
import { resolveOwnerEmail } from "@/lib/email/freshness";
import { sendOpportunityDigest } from "@/lib/email/opportunities";
import { sendSamKeyAlert } from "@/lib/email/sam-key-alert";
import { auditContextFromRequest, recordAuditEvent } from "@/lib/security/audit-log";
import { verifyCronSecret } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly cron — for each org with NAICS configured, calls SAM.gov, persists
 * new notices into `sam_opportunities`, and emails a digest of the freshly
 * inserted ones to the owner. Runs Mondays so subscribers see opportunities
 * top-of-inbox at the start of their bidding week.
 *
 * Skipped silently when SAM_GOV_API_KEY is not set so dev environments don't
 * crash the cron — production must set the key for radar to function.
 */
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    const ctx = auditContextFromRequest(req);
    await recordAuditEvent({
      action: "cron.unauthorized",
      resourceType: "cron",
      resourceId: "sam-radar",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      sent: 0,
      skipped_reason: "SAM_GOV_API_KEY not set",
    });
  }
  await initDb();

  const targets = await listRadarTargets();
  const workspaceUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://bidfedcmmc.com";

  let sent = 0;
  let inserted = 0;
  const skipped: Array<{ org: string; reason: string }> = [];

  for (const t of targets) {
    if (t.naics_codes.length === 0) {
      skipped.push({ org: t.organization_id, reason: "no_naics" });
      continue;
    }
    try {
      const opps = await fetchOpportunitiesForOrg({
        apiKey,
        naicsCodes: t.naics_codes,
        postedFromDays: 7,
      });
      const fresh = await persistOpportunities({
        organizationId: t.organization_id,
        opportunities: opps,
        setAsideCodes: t.set_aside_codes,
      });
      inserted += fresh.length;
      if (fresh.length === 0) {
        skipped.push({ org: t.organization_id, reason: "no_new_matches" });
        continue;
      }
      const owner = await resolveOwnerEmail(t.owner_user_id);
      if (!owner) {
        skipped.push({ org: t.organization_id, reason: "no_email" });
        continue;
      }
      // Top 10 by recency so the email stays scannable; the rest live in the
      // inbox UI.
      const top = fresh.slice(0, 10);
      await sendOpportunityDigest({
        toEmail: owner.email,
        firstName: owner.firstName,
        orgName: t.org_name,
        rows: top,
        workspaceUrl,
      });
      await markOpportunitiesDigested(top.map((r) => r.id));
      sent += 1;
    } catch (err) {
      // If SAM rejected our api_key, the rest of the run is doomed — bail
      // out, send the admin a single alert email, and skip every remaining
      // org so subscribers don't get stale-data digests.
      if (err instanceof SamApiKeyError) {
        console.error("[sam-radar] SAM api_key rejected — aborting run", err);
        try {
          await sendSamKeyAlert({
            status: err.status,
            body: err.body,
            orgsAffected: targets.length,
          });
        } catch (alertErr) {
          console.error("[sam-radar] failed to send admin alert", alertErr);
        }
        return NextResponse.json(
          {
            sent,
            inserted,
            orgs: targets.length,
            aborted_reason: "sam_api_key_rejected",
            sam_status: err.status,
          },
          { status: 200 },
        );
      }
      console.error(`[sam-radar] org ${t.organization_id} failed:`, err);
      skipped.push({
        org: t.organization_id,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    sent,
    inserted,
    orgs: targets.length,
    skipped,
  });
}

