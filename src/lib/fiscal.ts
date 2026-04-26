import {
  getSql,
  initDb,
  type MilestoneKind,
} from "@/lib/db";

/**
 * US federal fiscal year: Oct 1 (year N-1) → Sep 30 (year N). "FY2026" runs
 * Oct 1 2025 → Sep 30 2026. We store the ending-calendar-year value.
 */
export function fiscalYearOf(date: Date = new Date()): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed
  return month >= 9 ? year + 1 : year; // Oct = 9
}

export function fiscalYearStart(fy: number): Date {
  // Oct 1 of the prior calendar year.
  return new Date(Date.UTC(fy - 1, 9, 1));
}

export function fiscalYearEnd(fy: number): Date {
  // Sep 30 of the FY ending year.
  return new Date(Date.UTC(fy, 8, 30));
}

export function fiscalQuarter(date: Date = new Date()): 1 | 2 | 3 | 4 {
  const m = date.getUTCMonth(); // 0=Jan, 9=Oct
  if (m >= 9) return 1; // Oct-Dec
  if (m <= 2) return 2; // Jan-Mar
  if (m <= 5) return 3; // Apr-Jun
  return 4; // Jul-Sep
}

export function defaultCycleLabel(fy: number): string {
  return `FY${fy} Annual Affirmation`;
}

/**
 * Standard milestones seeded for a cycle when it's created. Dates are anchored
 * to the fiscal year; the affirmation is due by Sep 30 (end of FY). Quarterly
 * touchpoints keep tenants engaged between the creation and the attestation.
 */
export type MilestoneTemplate = {
  kind: MilestoneKind;
  title: string;
  description: string;
  /** Offset from fiscal year start in whole days. */
  daysFromStart: number;
};

export const defaultMilestones: MilestoneTemplate[] = [
  {
    kind: "onboarding",
    title: "Complete onboarding in The Platform",
    description:
      "Tell The Platform what your business does so the assessment is tailored to you.",
    daysFromStart: 0,
  },
  {
    kind: "q1_evidence_refresh",
    title: "Q1 evidence refresh",
    description:
      "Recapture any screenshots or rosters that change quarterly (user lists, admin roles, AV status).",
    daysFromStart: 60, // ~Dec 1
  },
  {
    kind: "q2_check",
    title: "Q2 mid-cycle checkpoint",
    description:
      "Check your progress against the 17 practices. Any 'Not met' or 'Partial' items get officer attention.",
    daysFromStart: 150, // ~Feb 28
  },
  {
    kind: "q3_prime_readiness",
    title: "Q3 prime-readiness review",
    description:
      "Contract-award season kicks up in Q3. Confirm your SSP, SPRS score, and SAM registration are presentable.",
    daysFromStart: 240, // ~May 29
  },
  {
    kind: "q4_prep",
    title: "Q4 affirmation prep",
    description:
      "Final evidence sweep before you re-affirm. Any Platform review verdicts marked 'insufficient' must be resolved.",
    daysFromStart: 330, // ~Aug 27
  },
  {
    kind: "affirmation_due",
    title: "Annual SPRS affirmation due",
    description:
      "Sign the affirmation and file in SPRS. This is the hard deadline for staying bid-eligible.",
    daysFromStart: 364, // Sep 30
  },
];

export async function seedMilestonesForAssessment(
  organizationId: string,
  assessmentId: string,
  fiscalYear: number,
): Promise<void> {
  await initDb();
  const sql = getSql();

  const start = fiscalYearStart(fiscalYear);
  const end = fiscalYearEnd(fiscalYear);
  const rows = defaultMilestones.map((m) => {
    // affirmation_due is always anchored to FY end (Sep 30), not an offset,
    // so it never drifts by a day because of leap years.
    const due =
      m.kind === "affirmation_due"
        ? new Date(end)
        : (() => {
            const d = new Date(start);
            d.setUTCDate(d.getUTCDate() + m.daysFromStart);
            return d;
          })();
    return {
      kind: m.kind,
      title: m.title,
      description: m.description,
      due: due.toISOString().slice(0, 10),
    };
  });

  // Arrays for unnest so we can insert all rows in one round-trip.
  const kinds = rows.map((r) => r.kind);
  const titles = rows.map((r) => r.title);
  const descriptions = rows.map((r) => r.description);
  const dueDates = rows.map((r) => r.due);

  await sql`
    INSERT INTO compliance_milestones
      (organization_id, assessment_id, fiscal_year, kind, title, description, due_date)
    SELECT ${organizationId}::uuid, ${assessmentId}::uuid, ${fiscalYear}, kind, title, description, due_date::date
    FROM UNNEST(
      ${kinds}::text[],
      ${titles}::text[],
      ${descriptions}::text[],
      ${dueDates}::text[]
    ) AS t(kind, title, description, due_date)
  `;
}

export type MilestoneRow = {
  id: string;
  organization_id: string;
  assessment_id: string | null;
  fiscal_year: number;
  kind: MilestoneKind;
  title: string;
  description: string | null;
  due_date: string;
  completed_at: string | null;
  snoozed_until: string | null;
  last_reminded_at: string | null;
  created_at: string;
};

export async function listMilestonesForOrg(
  organizationId: string,
): Promise<MilestoneRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, assessment_id, fiscal_year, kind, title,
           description, due_date::text AS due_date, completed_at,
           snoozed_until::text AS snoozed_until, last_reminded_at, created_at
    FROM compliance_milestones
    WHERE organization_id = ${organizationId}
    ORDER BY due_date ASC
  `) as MilestoneRow[];
}

export async function listUpcomingMilestones(
  organizationId: string,
  limit = 5,
): Promise<MilestoneRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, assessment_id, fiscal_year, kind, title,
           description, due_date::text AS due_date, completed_at,
           snoozed_until::text AS snoozed_until, last_reminded_at, created_at
    FROM compliance_milestones
    WHERE organization_id = ${organizationId}
      AND completed_at IS NULL
      AND (snoozed_until IS NULL OR snoozed_until <= NOW())
    ORDER BY due_date ASC
    LIMIT ${limit}
  `) as MilestoneRow[];
}

export async function markMilestoneCompleted(
  milestoneId: string,
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE compliance_milestones
    SET completed_at = NOW()
    WHERE id = ${milestoneId} AND organization_id = ${organizationId}
  `;
}

export async function snoozeMilestone(
  milestoneId: string,
  organizationId: string,
  until: string, // ISO date
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE compliance_milestones
    SET snoozed_until = ${until}::date
    WHERE id = ${milestoneId} AND organization_id = ${organizationId}
  `;
}

/**
 * Cron payload: milestones that are within 14 days (or overdue) AND haven't
 * been reminded in the last 6 days. Returned grouped by org so the cron can
 * post one consolidated message per org rather than one per milestone.
 */
export async function dueRemindersAcrossOrgs(): Promise<
  Array<{ organization_id: string; milestones: MilestoneRow[] }>
> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, organization_id, assessment_id, fiscal_year, kind, title,
           description, due_date::text AS due_date, completed_at,
           snoozed_until::text AS snoozed_until, last_reminded_at, created_at
    FROM compliance_milestones
    WHERE completed_at IS NULL
      AND (snoozed_until IS NULL OR snoozed_until <= NOW())
      AND due_date <= (NOW() + INTERVAL '14 days')::date
      AND (last_reminded_at IS NULL OR last_reminded_at < NOW() - INTERVAL '6 days')
    ORDER BY organization_id, due_date ASC
  `) as MilestoneRow[];

  const grouped = new Map<string, MilestoneRow[]>();
  for (const m of rows) {
    const list = grouped.get(m.organization_id) ?? [];
    list.push(m);
    grouped.set(m.organization_id, list);
  }
  return Array.from(grouped, ([organization_id, milestones]) => ({
    organization_id,
    milestones,
  }));
}

export async function markMilestonesReminded(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = getSql();
  await sql`
    UPDATE compliance_milestones
    SET last_reminded_at = NOW()
    WHERE id = ANY(${ids}::uuid[])
  `;
}

/**
 * Orgs whose latest assessment predates the current FY — i.e. the rollover
 * cron should spin up a fresh cycle for them. We gate on onboarding completion
 * so we don't create junk cycles for orgs that abandoned signup.
 */
export async function orgsNeedingRollover(
  targetFiscalYear: number,
): Promise<
  Array<{
    organization_id: string;
    owner_user_id: string;
    prior_assessment_id: string | null;
  }>
> {
  const sql = getSql();
  return (await sql`
    SELECT o.id AS organization_id,
           o.owner_user_id,
           (
             SELECT a.id FROM assessments a
             WHERE a.organization_id = o.id
             ORDER BY a.fiscal_year DESC, a.created_at DESC
             LIMIT 1
           ) AS prior_assessment_id
    FROM organizations o
    JOIN business_profile bp ON bp.organization_id = o.id
    WHERE o.scoped_systems IS NOT NULL
      AND o.scoped_systems <> ''
      AND bp.completeness_score >= 40
      AND NOT EXISTS (
        SELECT 1 FROM assessments a
        WHERE a.organization_id = o.id AND a.fiscal_year = ${targetFiscalYear}
      )
  `) as Array<{
    organization_id: string;
    owner_user_id: string;
    prior_assessment_id: string | null;
  }>;
}


/** Days until a given ISO date. Negative = overdue. */
export function daysUntil(isoDate: string): number {
  const due = new Date(isoDate + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.ceil((due - now) / (24 * 60 * 60 * 1000));
}
