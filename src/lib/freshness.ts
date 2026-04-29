import { getSql } from "@/lib/db";

/**
 * Evidence freshness watchtower.
 *
 * Each artifact has a `valid_until` date. The class (scan/screenshot/policy/
 * training/cert/misc) determines the default lifetime when none is set.
 * Cron `/api/cron/evidence-freshness` runs daily, finds artifacts crossing
 * threshold (30/14/3 days, or already overdue), debounces with
 * `staleness_notified_at`, and emails the org owner.
 *
 * The retention thesis: a customer who cancels watches their packet rot in
 * real time. Every scan that expires is a reason to come back.
 */

export const FRESHNESS_CLASSES = [
  "scan",
  "screenshot",
  "training",
  "policy",
  "cert",
  "misc",
] as const;
export type FreshnessClass = (typeof FRESHNESS_CLASSES)[number];

/** Default lifetime in days, by artifact class. */
export const DEFAULT_LIFETIME_DAYS: Record<FreshnessClass, number> = {
  scan: 30, // vuln scans, port scans — go stale fast
  screenshot: 90, // config screenshots can drift quickly
  training: 365, // annual training cycle
  policy: 365, // policy review cycle
  cert: 365, // most certs renew annually (insurance, ISO, etc.)
  misc: 365,
};

const SCAN_PATTERNS = [
  /\bnessus\b/i,
  /\btenable\b/i,
  /\bnmap\b/i,
  /\bopenvas\b/i,
  /\bqualys\b/i,
  /\brapid7\b/i,
  /\bvulnerability[_\s-]*scan\b/i,
  /\bvuln[_\s-]*scan\b/i,
  /\bpenetration[_\s-]*test\b/i,
  /\bpentest\b/i,
];
const TRAINING_PATTERNS = [
  /\btraining\b/i,
  /\bawareness\b/i,
  /\bcertificate[_\s-]*of[_\s-]*completion\b/i,
];
const POLICY_PATTERNS = [
  /\bpolicy\b/i,
  /\bprocedure\b/i,
  /\bplan\b/i,
  /\bssp\b/i,
];
const CERT_PATTERNS = [
  /\binsurance\b/i,
  /\bcoi\b/i,
  /\bcertificate\b/i,
  /\bcyber[_\s-]*liability\b/i,
];

/**
 * Heuristic class from filename + mimetype. Cheap, deterministic, no AI call.
 * Users can override per-artifact (UI surface lives on the control page).
 */
export function classifyArtifact(args: {
  filename: string;
  mimeType: string | null;
}): FreshnessClass {
  const name = args.filename;
  if (SCAN_PATTERNS.some((p) => p.test(name))) return "scan";
  if (TRAINING_PATTERNS.some((p) => p.test(name))) return "training";
  if (POLICY_PATTERNS.some((p) => p.test(name))) return "policy";
  if (CERT_PATTERNS.some((p) => p.test(name))) return "cert";
  if (args.mimeType?.startsWith("image/")) return "screenshot";
  return "misc";
}

export function defaultValidUntil(args: {
  capturedAt: Date;
  klass: FreshnessClass;
}): Date {
  const days = DEFAULT_LIFETIME_DAYS[args.klass];
  const out = new Date(args.capturedAt);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Apply class + valid_until to a freshly inserted artifact. Idempotent: only
 * sets values when columns are NULL. Called from uploadEvidenceAction right
 * after the INSERT.
 */
export async function stampFreshnessOnInsert(args: {
  artifactId: string;
  filename: string;
  mimeType: string | null;
}): Promise<void> {
  const klass = classifyArtifact({
    filename: args.filename,
    mimeType: args.mimeType,
  });
  const days = DEFAULT_LIFETIME_DAYS[klass];
  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET freshness_class = ${klass},
        valid_until = (captured_at + (${days} || ' days')::interval)::date
    WHERE id = ${args.artifactId}
      AND (freshness_class IS NULL OR valid_until IS NULL)
  `;
}

/**
 * User override of valid_until on a single artifact.
 */
export async function setArtifactValidUntil(args: {
  artifactId: string;
  validUntil: string; // YYYY-MM-DD
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET valid_until = ${args.validUntil}::date,
        staleness_notified_at = NULL
    WHERE id = ${args.artifactId}
  `;
}

export type FreshnessRow = {
  id: string;
  organization_id: string;
  assessment_id: string;
  control_id: string;
  filename: string;
  freshness_class: FreshnessClass | null;
  valid_until: string; // YYYY-MM-DD
  days_until: number;
  staleness_notified_at: string | null;
  org_name: string;
  owner_user_id: string;
};

/**
 * Find artifacts that cross a notification boundary (30/14/3 days out, or
 * overdue) AND haven't been re-notified in the past 6 days. Used by the cron.
 */
export async function dueFreshnessNotifications(): Promise<FreshnessRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      e.id,
      o.id   AS organization_id,
      o.name AS org_name,
      o.owner_user_id,
      e.assessment_id,
      e.control_id,
      e.filename,
      e.freshness_class,
      to_char(e.valid_until, 'YYYY-MM-DD') AS valid_until,
      (e.valid_until - CURRENT_DATE)::int  AS days_until,
      e.staleness_notified_at
    FROM evidence_artifacts e
    JOIN assessments a ON a.id = e.assessment_id
    JOIN organizations o ON o.id = a.organization_id
    WHERE e.valid_until IS NOT NULL
      AND e.valid_until <= CURRENT_DATE + INTERVAL '30 days'
      AND (
        e.staleness_notified_at IS NULL
        OR e.staleness_notified_at < NOW() - INTERVAL '6 days'
      )
    ORDER BY e.valid_until ASC
  `) as FreshnessRow[];
  return rows;
}

export async function listFreshnessForAssessment(
  assessmentId: string,
): Promise<
  Array<{
    id: string;
    control_id: string;
    filename: string;
    freshness_class: FreshnessClass | null;
    valid_until: string;
    days_until: number;
  }>
> {
  const sql = getSql();
  return (await sql`
    SELECT
      id, control_id, filename, freshness_class,
      to_char(valid_until, 'YYYY-MM-DD') AS valid_until,
      (valid_until - CURRENT_DATE)::int  AS days_until
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}
      AND valid_until IS NOT NULL
    ORDER BY valid_until ASC
  `) as Array<{
    id: string;
    control_id: string;
    filename: string;
    freshness_class: FreshnessClass | null;
    valid_until: string;
    days_until: number;
  }>;
}

export async function markFreshnessNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET staleness_notified_at = NOW()
    WHERE id = ANY(${ids}::uuid[])
  `;
}

/**
 * Group rows by org so the cron sends one email per org rather than one per
 * artifact.
 */
export function groupByOrg(rows: FreshnessRow[]): Array<{
  organization_id: string;
  org_name: string;
  owner_user_id: string;
  rows: FreshnessRow[];
}> {
  const map = new Map<string, FreshnessRow[]>();
  for (const r of rows) {
    const existing = map.get(r.organization_id);
    if (existing) existing.push(r);
    else map.set(r.organization_id, [r]);
  }
  return Array.from(map.entries()).map(([organization_id, rs]) => ({
    organization_id,
    org_name: rs[0].org_name,
    owner_user_id: rs[0].owner_user_id,
    rows: rs,
  }));
}

export function freshnessClassLabel(klass: FreshnessClass | null): string {
  if (!klass) return "Evidence";
  return {
    scan: "Vulnerability scan",
    screenshot: "Configuration screenshot",
    training: "Training record",
    policy: "Policy document",
    cert: "Certificate",
    misc: "Evidence",
  }[klass];
}

/** Strip the `[q:<id>]__` quiz tag from filenames for display. */
export function displayFilename(name: string): string {
  return name.replace(/^\[q:[^\]]+\]__/, "");
}
