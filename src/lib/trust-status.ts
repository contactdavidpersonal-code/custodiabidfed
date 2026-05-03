import { ensureDbReady, getSql } from "@/lib/db";
import { playbook } from "@/lib/playbook";

/**
 * Custodia trust-status engine.
 *
 * Computes a single deterministic health verdict per organization that powers
 * the live "Healthy / Drift / Action required" pill on every public Verified
 * page and badge. Health is recomputed by:
 *   - hourly cron (`/api/cron/trust-status-rollup`) for all published orgs
 *   - synchronously after connector sync, evidence freshness scan, drift
 *     detection, and SPRS filing
 *
 * Rules (in priority order):
 *   RED     — affirmation lapsed >365d, or drift open >14d, or all
 *             connectors revoked unreplaced
 *   AMBER   — drift open ≤14d, OR connector last sync >48h, OR newest
 *             evidence >300d, OR <60d to next reaffirmation due
 *   GREEN   — affirmation <365d AND no open drift AND
 *             at least one connector synced within 24h AND
 *             newest evidence <365d
 *   GRAY    — never published OR no SPRS filing on record yet
 */

export type TrustHealth = "green" | "amber" | "red" | "gray";

export interface TrustStatusSnapshot {
  organizationId: string;
  health: TrustHealth;
  healthReason: string;
  practicesMet: number;
  practicesTotal: number;
  evidenceCount: number;
  oldestEvidenceAgeDays: number | null;
  newestEvidenceAgeDays: number | null;
  m365ConnectedAt: string | null;
  m365LastSyncAt: string | null;
  googleConnectedAt: string | null;
  googleLastSyncAt: string | null;
  openDriftCount: number;
  driftDetectedAt: string | null;
  driftResolvedAt: string | null;
  affirmationFiledAt: string | null;
  nextReaffirmDue: string | null;
  lastComputedAt: string;
}

const CMMC_LV1_PRACTICE_TOTAL = playbook.length;
const REAFFIRM_PERIOD_DAYS = 365;
const AMBER_REAFFIRM_WINDOW_DAYS = 60;
const AMBER_EVIDENCE_AGE_DAYS = 300;
const RED_EVIDENCE_AGE_DAYS = REAFFIRM_PERIOD_DAYS;
const GREEN_CONNECTOR_SYNC_HOURS = 24;
const AMBER_CONNECTOR_SYNC_HOURS = 48;
const RED_DRIFT_OPEN_DAYS = 14;

/**
 * Recompute and persist the trust status snapshot for one organization.
 * Idempotent: safe to run from any number of triggers and crons.
 */
export async function recomputeTrustStatus(
  organizationId: string,
): Promise<TrustStatusSnapshot> {
  await ensureDbReady();
  const sql = getSql();

  // ---- Latest filed assessment (drives reaffirmation window) -------------
  const [latestAssessment] = (await sql`
    SELECT
      id,
      sprs_filed_at,
      affirmed_at,
      fiscal_year
    FROM assessments
    WHERE organization_id = ${organizationId}
      AND sprs_filed_at IS NOT NULL
    ORDER BY sprs_filed_at DESC
    LIMIT 1
  `) as Array<{
    id: string;
    sprs_filed_at: string;
    affirmed_at: string | null;
    fiscal_year: number;
  }>;

  // ---- Practices met (current cycle) -------------------------------------
  let practicesMet = 0;
  if (latestAssessment) {
    const [row] = (await sql`
      SELECT COUNT(*)::int AS met
      FROM control_responses
      WHERE assessment_id = ${latestAssessment.id}
        AND status = 'yes'
    `) as Array<{ met: number }>;
    practicesMet = row?.met ?? 0;
  }

  // ---- Evidence freshness (most recent assessment scope) -----------------
  let evidenceCount = 0;
  let oldestEvidenceAgeDays: number | null = null;
  let newestEvidenceAgeDays: number | null = null;
  if (latestAssessment) {
    const [row] = (await sql`
      SELECT
        COUNT(*)::int AS cnt,
        EXTRACT(EPOCH FROM (NOW() - MIN(captured_at))) / 86400.0 AS oldest_days,
        EXTRACT(EPOCH FROM (NOW() - MAX(captured_at))) / 86400.0 AS newest_days
      FROM evidence_artifacts
      WHERE assessment_id = ${latestAssessment.id}
    `) as Array<{
      cnt: number;
      oldest_days: number | null;
      newest_days: number | null;
    }>;
    evidenceCount = row?.cnt ?? 0;
    oldestEvidenceAgeDays =
      row?.oldest_days != null ? Math.round(row.oldest_days) : null;
    newestEvidenceAgeDays =
      row?.newest_days != null ? Math.round(row.newest_days) : null;
  }

  // ---- Connectors --------------------------------------------------------
  const connectors = (await sql`
    SELECT provider, connected_at, last_used_at, revoked_at
    FROM connector_tokens
    WHERE organization_id = ${organizationId}
  `) as Array<{
    provider: string;
    connected_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }>;
  const m365 = connectors.find(
    (c) => (c.provider === "m365" || c.provider === "microsoft365") && !c.revoked_at,
  );
  const google = connectors.find(
    (c) =>
      (c.provider === "google" || c.provider === "google_workspace") &&
      !c.revoked_at,
  );
  const allConnectorsRevoked =
    connectors.length > 0 && connectors.every((c) => !!c.revoked_at);

  // ---- Drift -------------------------------------------------------------
  const [driftRow] = (await sql`
    SELECT
      COUNT(*)::int AS open_count,
      MIN(detected_at) AS oldest_open,
      MAX(detected_at) AS most_recent
    FROM drift_events
    WHERE organization_id = ${organizationId}
      AND resolved_at IS NULL
  `) as Array<{
    open_count: number;
    oldest_open: string | null;
    most_recent: string | null;
  }>;
  const openDriftCount = driftRow?.open_count ?? 0;
  const driftDetectedAt = driftRow?.most_recent ?? null;
  const oldestOpenDriftAt = driftRow?.oldest_open ?? null;

  // ---- Compute reaffirmation window --------------------------------------
  const affirmationFiledAt = latestAssessment?.sprs_filed_at ?? null;
  let nextReaffirmDue: string | null = null;
  if (affirmationFiledAt) {
    const filed = new Date(affirmationFiledAt).getTime();
    nextReaffirmDue = new Date(
      filed + REAFFIRM_PERIOD_DAYS * 24 * 3600 * 1000,
    ).toISOString();
  }

  const now = Date.now();
  const daysSinceFiled =
    affirmationFiledAt != null
      ? (now - new Date(affirmationFiledAt).getTime()) / 86400000
      : null;
  const daysToReaffirm =
    nextReaffirmDue != null
      ? (new Date(nextReaffirmDue).getTime() - now) / 86400000
      : null;
  const oldestOpenDriftDays =
    oldestOpenDriftAt != null
      ? (now - new Date(oldestOpenDriftAt).getTime()) / 86400000
      : null;

  const m365SyncHrs =
    m365?.last_used_at != null
      ? (now - new Date(m365.last_used_at).getTime()) / 3600000
      : null;
  const googleSyncHrs =
    google?.last_used_at != null
      ? (now - new Date(google.last_used_at).getTime()) / 3600000
      : null;
  const minSyncHrs = [m365SyncHrs, googleSyncHrs].filter(
    (h): h is number => h != null,
  );
  const freshestSyncHrs = minSyncHrs.length > 0 ? Math.min(...minSyncHrs) : null;

  // ---- Health verdict (priority: gray → red → amber → green) -------------
  let health: TrustHealth = "gray";
  let healthReason = "Awaiting first health snapshot.";

  if (!affirmationFiledAt) {
    health = "gray";
    healthReason = "No SPRS filing on record yet.";
  } else if (
    (daysSinceFiled != null && daysSinceFiled > REAFFIRM_PERIOD_DAYS) ||
    (oldestOpenDriftDays != null && oldestOpenDriftDays > RED_DRIFT_OPEN_DAYS) ||
    allConnectorsRevoked ||
    (newestEvidenceAgeDays != null &&
      newestEvidenceAgeDays > RED_EVIDENCE_AGE_DAYS)
  ) {
    health = "red";
    if (daysSinceFiled != null && daysSinceFiled > REAFFIRM_PERIOD_DAYS) {
      healthReason = "Annual re-affirmation has lapsed — file in SPRS to restore.";
    } else if (
      oldestOpenDriftDays != null &&
      oldestOpenDriftDays > RED_DRIFT_OPEN_DAYS
    ) {
      healthReason = `Drift event open longer than ${RED_DRIFT_OPEN_DAYS} days.`;
    } else if (allConnectorsRevoked) {
      healthReason = "All monitoring connectors are revoked.";
    } else {
      healthReason = "Evidence is stale (>1 year old).";
    }
  } else if (
    openDriftCount > 0 ||
    (freshestSyncHrs != null && freshestSyncHrs > AMBER_CONNECTOR_SYNC_HOURS) ||
    (newestEvidenceAgeDays != null &&
      newestEvidenceAgeDays > AMBER_EVIDENCE_AGE_DAYS) ||
    (daysToReaffirm != null && daysToReaffirm < AMBER_REAFFIRM_WINDOW_DAYS)
  ) {
    health = "amber";
    if (openDriftCount > 0) {
      healthReason = `${openDriftCount} drift event${openDriftCount === 1 ? "" : "s"} under investigation.`;
    } else if (
      freshestSyncHrs != null &&
      freshestSyncHrs > AMBER_CONNECTOR_SYNC_HOURS
    ) {
      healthReason = "Monitoring connector hasn't synced in over 48 hours.";
    } else if (
      newestEvidenceAgeDays != null &&
      newestEvidenceAgeDays > AMBER_EVIDENCE_AGE_DAYS
    ) {
      healthReason = "Evidence is approaching its 1-year freshness window.";
    } else {
      healthReason = "Annual re-affirmation due within 60 days.";
    }
  } else if (
    affirmationFiledAt &&
    (freshestSyncHrs == null ||
      freshestSyncHrs <= GREEN_CONNECTOR_SYNC_HOURS) &&
    openDriftCount === 0
  ) {
    health = "green";
    healthReason = "Affirmation current, monitoring active, no drift.";
  } else {
    health = "amber";
    healthReason = "Monitoring signal incomplete.";
  }

  const snapshot: TrustStatusSnapshot = {
    organizationId,
    health,
    healthReason,
    practicesMet,
    practicesTotal: CMMC_LV1_PRACTICE_TOTAL,
    evidenceCount,
    oldestEvidenceAgeDays,
    newestEvidenceAgeDays,
    m365ConnectedAt: m365?.connected_at ?? null,
    m365LastSyncAt: m365?.last_used_at ?? null,
    googleConnectedAt: google?.connected_at ?? null,
    googleLastSyncAt: google?.last_used_at ?? null,
    openDriftCount,
    driftDetectedAt,
    driftResolvedAt: null,
    affirmationFiledAt,
    nextReaffirmDue,
    lastComputedAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO trust_status (
      organization_id, health, health_reason,
      practices_met, practices_total,
      evidence_count, oldest_evidence_age_days, newest_evidence_age_days,
      m365_connected_at, m365_last_sync_at,
      google_connected_at, google_last_sync_at,
      open_drift_count, drift_detected_at,
      affirmation_filed_at, next_reaffirm_due,
      last_computed_at
    ) VALUES (
      ${organizationId}, ${health}, ${healthReason},
      ${practicesMet}, ${CMMC_LV1_PRACTICE_TOTAL},
      ${evidenceCount}, ${oldestEvidenceAgeDays}, ${newestEvidenceAgeDays},
      ${m365?.connected_at ?? null}, ${m365?.last_used_at ?? null},
      ${google?.connected_at ?? null}, ${google?.last_used_at ?? null},
      ${openDriftCount}, ${driftDetectedAt},
      ${affirmationFiledAt}, ${nextReaffirmDue},
      NOW()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      health = EXCLUDED.health,
      health_reason = EXCLUDED.health_reason,
      practices_met = EXCLUDED.practices_met,
      practices_total = EXCLUDED.practices_total,
      evidence_count = EXCLUDED.evidence_count,
      oldest_evidence_age_days = EXCLUDED.oldest_evidence_age_days,
      newest_evidence_age_days = EXCLUDED.newest_evidence_age_days,
      m365_connected_at = EXCLUDED.m365_connected_at,
      m365_last_sync_at = EXCLUDED.m365_last_sync_at,
      google_connected_at = EXCLUDED.google_connected_at,
      google_last_sync_at = EXCLUDED.google_last_sync_at,
      open_drift_count = EXCLUDED.open_drift_count,
      drift_detected_at = EXCLUDED.drift_detected_at,
      affirmation_filed_at = EXCLUDED.affirmation_filed_at,
      next_reaffirm_due = EXCLUDED.next_reaffirm_due,
      last_computed_at = NOW()
  `;

  return snapshot;
}

/**
 * Recompute trust status for every organization that has a published
 * trust page. Used by the hourly cron and any "republish all" admin op.
 */
export async function recomputeAllPublishedTrustStatuses(): Promise<{
  computed: number;
  failed: number;
}> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT organization_id
    FROM trust_pages
    WHERE is_public = TRUE
  `) as Array<{ organization_id: string }>;

  let computed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await recomputeTrustStatus(row.organization_id);
      computed += 1;
    } catch (err) {
      failed += 1;
      console.error("[trust-status] recompute failed", row.organization_id, err);
    }
  }
  return { computed, failed };
}

/**
 * Open a drift event for an organization. Idempotent on (org, control, signal):
 * a duplicate open record is suppressed if one already exists unresolved.
 */
export async function openDriftEvent(input: {
  organizationId: string;
  controlId: string;
  signal: string;
  severity?: "info" | "warn" | "critical";
  detail?: Record<string, unknown>;
}): Promise<void> {
  await ensureDbReady();
  const sql = getSql();
  const severity = input.severity ?? "warn";
  const detail = input.detail ?? {};
  await sql`
    INSERT INTO drift_events (
      organization_id, control_id, signal, severity, detail
    )
    SELECT ${input.organizationId}, ${input.controlId}, ${input.signal},
           ${severity}, ${JSON.stringify(detail)}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM drift_events
      WHERE organization_id = ${input.organizationId}
        AND control_id = ${input.controlId}
        AND signal = ${input.signal}
        AND resolved_at IS NULL
    )
  `;
  await recomputeTrustStatus(input.organizationId).catch((err) => {
    console.error("[trust-status] post-open recompute failed", err);
  });
}

/**
 * Resolve all open drift events for a (org, control, signal). Used when the
 * underlying signal recovers on the next connector poll.
 */
export async function resolveDriftEvents(input: {
  organizationId: string;
  controlId: string;
  signal: string;
}): Promise<number> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    UPDATE drift_events
    SET resolved_at = NOW()
    WHERE organization_id = ${input.organizationId}
      AND control_id = ${input.controlId}
      AND signal = ${input.signal}
      AND resolved_at IS NULL
    RETURNING id
  `) as Array<{ id: string }>;
  if (rows.length > 0) {
    await recomputeTrustStatus(input.organizationId).catch((err) => {
      console.error("[trust-status] post-resolve recompute failed", err);
    });
  }
  return rows.length;
}
