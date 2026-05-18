import {
  getSql,
  initDb,
  ensureDbReady,
  type AssessmentStatus,
  type CarryForwardStatus,
  type ControlResponseStatus,
  type EvidenceVerdict,
  type Framework,
  type RemediationStatus,
} from "@/lib/db";
import { getPlaybookForFramework, playbookById } from "@/lib/playbook";
import { seedObjectiveRows } from "@/lib/cmmc/objectives";
import { fiscalYearOf, seedMilestonesForAssessment } from "@/lib/fiscal";
import { redirect } from "next/navigation";
import { tryDecryptField } from "@/lib/security/field-encryption";

export type OrganizationRow = {
  id: string;
  owner_user_id: string;
  /**
   * Clerk Organization id this workspace is linked to. Null for legacy
   * personal-account workspaces (single-user). Required for team
   * features (invites, Senior Official transfer) which are surfaced on
   * /settings/team.
   */
  clerk_org_id: string | null;
  name: string;
  entity_type: string | null;
  cage_code: string | null;
  sam_uei: string | null;
  naics_codes: string[];
  tier: "solo" | "bootcamp" | "command";
  scoped_systems: string | null;
  /**
   * Clerk user_id of the designated Senior Official for this org — the
   * only person allowed to sign the CMMC L1 affirmation under
   * 32 CFR § 170.21(a)(2). Auto-set to the org creator on first
   * provision; transferable later via designateSeniorOfficialAction.
   */
  senior_official_user_id: string | null;
  /**
   * Timestamp the senior official confirmed they understand the
   * personal-liability implications (FCA + 18 U.S.C. § 1001) on
   * /welcome/senior-official. Pre-flight gate before any assessment work.
   */
  senior_official_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentRow = {
  id: string;
  organization_id: string;
  cycle_label: string;
  status: AssessmentStatus;
  framework: Framework;
  fiscal_year: number;
  submitted_at: string | null;
  affirmed_at: string | null;
  affirmed_by_name: string | null;
  affirmed_by_title: string | null;
  /**
   * SPRS "Affirming Official Email" — required at sign time for CMMC L1.
   * Persisted in plaintext (used for renewal reminders + visible to the
   * AO in the sealed attestation packet); not considered sensitive PII
   * because it's the same address SPRS publishes on the Cyber Reports
   * filing record under DFARS 252.204-7021.
   */
  affirming_official_email: string | null;
  /**
   * Day the self-assessment work itself was completed. May differ from
   * `affirmed_at` (the AO signature day) when the AO signs later. SPRS
   * "Add New Level 1 CMMC Self-Assessment" expects this as a discrete
   * date field; defaults to affirmation day when the user doesn't
   * specify.
   */
  self_assessment_completed_at: string | null;
  sprs_score: number | null;
  implements_all_17: boolean | null;
  carried_forward_from: string | null;
  /**
   * Material-change interview state for carry-forward cycles. Scoping
   * Guide L1 v2.13 § 170.19 p. 4 requires a fresh assessment when there
   * are significant architectural or boundary changes since the prior
   * cycle. We surface a short interview on first entry to a carried
   * cycle and persist the outcome here.
   *
   * - `material_change_reviewed_at` — timestamp of the interview
   *   submission. Null = interview not yet completed.
   * - `material_change_required_reassessment` — true when any answer was
   *   "yes" (carry-forward was wiped; user is re-walking the practices).
   * - `material_change_details` — raw answers + free-text rationale.
   */
  material_change_reviewed_at: string | null;
  material_change_required_reassessment: boolean | null;
  material_change_details: Record<string, unknown> | null;
  sprs_filed_at: string | null;
  sprs_confirmation_number: string | null;
  sprs_status_date: string | null;
  sprs_attestation_hash: string | null;
  custodia_verification_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Tier 1 zero-trust read helper. Every place that loads an assessment row
 * for display / export / API serialization passes the row through this
 * before returning. Legacy plaintext values pass through unchanged
 * (tryDecryptField is permissive); new ciphertext values are decrypted
 * under per-tenant AAD. Apply to ANY raw SELECT from `assessments` that
 * exposes signer fields or the canonical attestation packet.
 */
export async function decryptAssessmentSensitiveFields<
  T extends {
    organization_id: string;
    affirmed_by_name?: string | null;
    affirmed_by_title?: string | null;
    attestation_canonical?: string | null;
  },
>(row: T): Promise<T> {
  const orgId = row.organization_id;
  const [name, title, canonical] = await Promise.all([
    tryDecryptField(row.affirmed_by_name ?? null, {
      organizationId: orgId,
      field: "assessments.affirmed_by_name",
    }),
    tryDecryptField(row.affirmed_by_title ?? null, {
      organizationId: orgId,
      field: "assessments.affirmed_by_title",
    }),
    row.attestation_canonical === undefined
      ? Promise.resolve(undefined)
      : tryDecryptField(row.attestation_canonical ?? null, {
          organizationId: orgId,
          field: "assessments.attestation_canonical",
        }),
  ]);
  return {
    ...row,
    affirmed_by_name: name,
    affirmed_by_title: title,
    ...(row.attestation_canonical === undefined
      ? {}
      : { attestation_canonical: canonical ?? null }),
  } as T;
}

export type ControlResponseRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  status: ControlResponseStatus;
  narrative: string | null;
  officer_reviewed: boolean;
  officer_reviewed_at: string | null;
  officer_reviewer_user_id: string | null;
  carry_forward_status: CarryForwardStatus;
  updated_at: string;
};

export type RemediationPlanRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  gap_summary: string;
  planned_actions: string;
  target_close_date: string;
  status: RemediationStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export async function ensureOrgForUser(userId: string): Promise<OrganizationRow> {
  // MSP multi-tenancy: when the request is being served on behalf of a
  // signed-in user with an Active Organization (Clerk Organization), use
  // the org-scoped row instead of the user's legacy personal org. This
  // keeps every existing callsite (~30 files) automatically tenancy-aware
  // without changing any signatures. Falls back to legacy behaviour when
  // there is no active Clerk org (solo founder UX unchanged).
  try {
    const { auth, clerkClient } = await import("@clerk/nextjs/server");
    const a = await auth();
    if (a.orgId) {
      let clerkOrgName: string | null = null;
      try {
        const cc = await clerkClient();
        const o = await cc.organizations.getOrganization({
          organizationId: a.orgId,
        });
        clerkOrgName = o?.name ?? null;
      } catch {
        // Non-fatal — fall back to placeholder.
      }
      return resolveActiveOrg({
        userId,
        clerkOrgId: a.orgId,
        clerkOrgName,
      });
    }
  } catch {
    // auth() throws when called outside a request context (e.g. cron
    // scripts). In that case, fall through to the legacy personal-org
    // path below.
  }

  return ensureLegacyPersonalOrg(userId);
}

async function ensureLegacyPersonalOrg(
  userId: string,
): Promise<OrganizationRow> {
  await initDb();
  const sql = getSql();

  const existing = (await sql`
    SELECT id, owner_user_id, clerk_org_id, name, entity_type, cage_code, sam_uei,
           naics_codes, tier, scoped_systems,
           senior_official_user_id, senior_official_acknowledged_at,
           created_at, updated_at
    FROM organizations
    WHERE owner_user_id = ${userId}
      AND clerk_org_id IS NULL
    LIMIT 1
  `) as OrganizationRow[];

  if (existing.length > 0) {
    await ensureBusinessProfile(existing[0].id);
    return existing[0];
  }

  // First-time provision: the creator is auto-designated as the Senior
  // Official (32 CFR § 170.21(a)(2)). They confirm the role on
  // /welcome/senior-official before any assessment work begins. If the
  // creator is actually setting this up *for* someone else (e.g. IT
  // manager preparing the workspace for the owner), they can transfer
  // the designation from /settings/team once team invites ship (PR #2).
  //
  // ON CONFLICT against the partial unique index makes this race-proof:
  // if a concurrent RSC render inserted first, we fall through to a
  // re-SELECT of the winning row instead of throwing 23505.
  const inserted = (await sql`
    INSERT INTO organizations (
      owner_user_id, name, tier, senior_official_user_id
    )
    VALUES (${userId}, ${"My Organization"}, 'solo', ${userId})
    ON CONFLICT (owner_user_id) WHERE clerk_org_id IS NULL DO NOTHING
    RETURNING id, owner_user_id, clerk_org_id, name, entity_type, cage_code, sam_uei,
              naics_codes, tier, scoped_systems,
              senior_official_user_id, senior_official_acknowledged_at,
              created_at, updated_at
  `) as OrganizationRow[];

  if (inserted.length === 0) {
    // Lost the race — the row exists, fetch it.
    const winner = (await sql`
      SELECT id, owner_user_id, clerk_org_id, name, entity_type, cage_code, sam_uei,
             naics_codes, tier, scoped_systems,
             senior_official_user_id, senior_official_acknowledged_at,
             created_at, updated_at
      FROM organizations
      WHERE owner_user_id = ${userId}
        AND clerk_org_id IS NULL
      LIMIT 1
    `) as OrganizationRow[];
    await ensureBusinessProfile(winner[0].id);
    return winner[0];
  }

  await ensureBusinessProfile(inserted[0].id);
  return inserted[0];
}

/**
 * MSP multi-tenancy resolver. Returns the organization row that the user
 * is currently *acting as*, derived from their Clerk session:
 *
 * - If `clerkOrgId` is provided (user has selected an Active Organization
 *   via the OrgSwitcher), look up by `clerk_org_id`. On first visit, the
 *   row is provisioned with the Clerk Organization's display name so the
 *   header reads correctly without a separate sync step.
 * - If `clerkOrgId` is null (user is in their Personal Account), fall
 *   through to the legacy single-org-per-user behaviour. This preserves
 *   solo founder UX exactly as it was pre-MSP.
 *
 * Same return shape as ensureOrgForUser, so existing code paths can swap
 * one call for the other without further changes.
 */
export async function resolveActiveOrg(args: {
  userId: string;
  clerkOrgId: string | null | undefined;
  /** Optional: human-readable org name from Clerk (when known). Used only on first provision. */
  clerkOrgName?: string | null;
}): Promise<OrganizationRow> {
  if (!args.clerkOrgId) {
    return ensureOrgForUser(args.userId);
  }
  await initDb();
  const sql = getSql();

  const existing = (await sql`
    SELECT id, owner_user_id, clerk_org_id, name, entity_type, cage_code, sam_uei,
           naics_codes, tier, scoped_systems,
           senior_official_user_id, senior_official_acknowledged_at,
           created_at, updated_at
    FROM organizations
    WHERE clerk_org_id = ${args.clerkOrgId}
    LIMIT 1
  `) as OrganizationRow[];

  if (existing.length > 0) {
    await ensureBusinessProfile(existing[0].id);
    return existing[0];
  }

  const displayName =
    (args.clerkOrgName && args.clerkOrgName.trim().length > 0
      ? args.clerkOrgName.trim()
      : "Managed business");

  // First-provision senior_official: stamp the first visitor as the
  // designated Senior Official. They'll confirm the role on
  // /welcome/senior-official before any assessment work begins. If a
  // contributor was the first to visit a brand-new Clerk org (e.g. an
  // IT manager setting up for an owner), the designation can be
  // transferred from /settings/team (PR #2).
  //
  // ON CONFLICT against the Clerk-org partial unique index makes this
  // race-proof under concurrent RSC fan-out.
  const inserted = (await sql`
    INSERT INTO organizations (
      owner_user_id, clerk_org_id, name, tier, senior_official_user_id
    )
    VALUES (${args.userId}, ${args.clerkOrgId}, ${displayName}, 'solo', ${args.userId})
    ON CONFLICT (clerk_org_id) WHERE clerk_org_id IS NOT NULL DO NOTHING
    RETURNING id, owner_user_id, clerk_org_id, name, entity_type, cage_code, sam_uei,
              naics_codes, tier, scoped_systems,
              senior_official_user_id, senior_official_acknowledged_at,
              created_at, updated_at
  `) as OrganizationRow[];

  if (inserted.length === 0) {
    const winner = (await sql`
      SELECT id, owner_user_id, clerk_org_id, name, entity_type, cage_code, sam_uei,
             naics_codes, tier, scoped_systems,
             senior_official_user_id, senior_official_acknowledged_at,
             created_at, updated_at
      FROM organizations
      WHERE clerk_org_id = ${args.clerkOrgId}
      LIMIT 1
    `) as OrganizationRow[];
    await ensureBusinessProfile(winner[0].id);
    return winner[0];
  }

  await ensureBusinessProfile(inserted[0].id);
  return inserted[0];
}

/**
 * High-level entry point: reads Clerk auth(), pulls the active Clerk
 * org id (if any), resolves the matching DB org row, and on first visit
 * fetches the Clerk org name to seed `organizations.name`. Use this in
 * preference to ensureOrgForUser everywhere a request is being served on
 * behalf of the signed-in user. Server-only.
 */
export async function getActiveOrgFromAuth(): Promise<OrganizationRow | null> {
  // Lazy import to keep this module usable from contexts that already have
  // their own auth() call without forcing a circular import.
  const { auth, clerkClient } = await import("@clerk/nextjs/server");
  const { userId, orgId } = await auth();
  if (!userId) return null;
  if (!orgId) {
    return ensureOrgForUser(userId);
  }
  // First-provision name lookup — only hits Clerk's API the first time we
  // see this orgId; subsequent visits hit the local row directly.
  let clerkOrgName: string | null = null;
  try {
    const cc = await clerkClient();
    const o = await cc.organizations.getOrganization({ organizationId: orgId });
    clerkOrgName = o?.name ?? null;
  } catch {
    // Non-fatal — fall back to the placeholder name. The user can rename
    // via onboarding or the Clerk OrganizationProfile UI.
  }
  return resolveActiveOrg({ userId, clerkOrgId: orgId, clerkOrgName });
}

export type BusinessProfileRow = {
  organization_id: string;
  data: Record<string, unknown>;
  completeness_score: number;
  last_updated_at: string;
  last_updated_by: "user" | "ai";
};

/**
 * Ensures a business_profile row exists for an org. Empty JSON to start; the
 * conversational onboarding flow rewrites the `data` blob over time.
 */
export async function ensureBusinessProfile(
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO business_profile (organization_id)
    VALUES (${organizationId}::uuid)
    ON CONFLICT (organization_id) DO NOTHING
  `;
}

export async function getBusinessProfile(
  organizationId: string,
): Promise<BusinessProfileRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT organization_id, data, completeness_score, last_updated_at, last_updated_by
    FROM business_profile
    WHERE organization_id = ${organizationId}
    LIMIT 1
  `) as BusinessProfileRow[];
  return rows[0] ?? null;
}

/**
 * Onboarding is "complete enough" to drop the user into the workspace when the
 * business profile has any meaningful captured data AND the org has a real
 * legal name + a scoped_systems paragraph. The completeness_score threshold is
 * intentionally low (40) — the officer can keep enriching the profile inside
 * the workspace; we just need enough to personalize.
 */
export function isOnboardingComplete(
  org: OrganizationRow,
  profile: BusinessProfileRow | null,
): boolean {
  const hasLegalName =
    org.name.trim().length > 0 && org.name !== "My Organization";
  const hasScopedSystems =
    (org.scoped_systems ?? "").trim().length > 0;
  const hasProfile = (profile?.completeness_score ?? 0) >= 40;
  return hasLegalName && hasScopedSystems && hasProfile;
}

export async function updateBusinessProfile(
  organizationId: string,
  data: Record<string, unknown>,
  completenessScore: number,
  updatedBy: "user" | "ai",
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO business_profile
      (organization_id, data, completeness_score, last_updated_at, last_updated_by)
    VALUES (${organizationId}::uuid, ${JSON.stringify(data)}::jsonb,
            ${completenessScore}, NOW(), ${updatedBy})
    ON CONFLICT (organization_id) DO UPDATE
    SET data = EXCLUDED.data,
        completeness_score = EXCLUDED.completeness_score,
        last_updated_at = EXCLUDED.last_updated_at,
        last_updated_by = EXCLUDED.last_updated_by
  `;
}

export async function listAssessmentsForOrg(
  organizationId: string,
): Promise<AssessmentRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, organization_id, cycle_label, status, framework, fiscal_year,
           submitted_at, affirmed_at, affirmed_by_name, affirmed_by_title,
           affirming_official_email, self_assessment_completed_at,
           sprs_score, implements_all_17, carried_forward_from,
           material_change_reviewed_at, material_change_required_reassessment,
           material_change_details,
           sprs_filed_at, sprs_confirmation_number, sprs_status_date,
           sprs_attestation_hash, custodia_verification_id,
           created_at, updated_at
    FROM assessments
    WHERE organization_id = ${organizationId}
    ORDER BY created_at DESC
  `) as AssessmentRow[];
  return Promise.all(rows.map(decryptAssessmentSensitiveFields));
}

export type AssessmentWithProgress = AssessmentRow & {
  answered: number;
  total: number;
  percentAnswered: number;
};

/**
 * Annual re-affirmation lapse status for an organization. Per 32 CFR
 * § 170.15(c)(2) the Senior Official must re-affirm CMMC L1 annually —
 * SPRS automatically flips a posting to expired after 365 days. We track
 * the same window so the dashboard can scream when an org has drifted
 * past it, and the sign action can refuse to "refresh" a stale memo
 * (forcing the user to create a fresh fiscal-year cycle instead).
 *
 * Returns `null` when the org has never filed (no prior affirmation to
 * lapse).
 */
export async function getOrgAffirmationLapse(
  organizationId: string,
): Promise<{
  lastAffirmedAt: string;
  lastAssessmentId: string;
  lastCycleLabel: string;
  daysSince: number;
  isLapsed: boolean;
} | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, cycle_label, affirmed_at
    FROM assessments
    WHERE organization_id = ${organizationId}
      AND affirmed_at IS NOT NULL
    ORDER BY affirmed_at DESC
    LIMIT 1
  `) as Array<{ id: string; cycle_label: string; affirmed_at: string }>;
  if (rows.length === 0) return null;
  const row = rows[0];
  const ageMs = Date.now() - new Date(row.affirmed_at).getTime();
  const daysSince = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  return {
    lastAffirmedAt: row.affirmed_at,
    lastAssessmentId: row.id,
    lastCycleLabel: row.cycle_label,
    daysSince,
    isLapsed: daysSince > 365,
  };
}

export async function listAssessmentsWithProgress(
  organizationId: string,
): Promise<AssessmentWithProgress[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id, a.organization_id, a.cycle_label, a.status, a.framework,
           a.fiscal_year, a.submitted_at, a.affirmed_at, a.affirmed_by_name,
           a.affirmed_by_title, a.affirming_official_email,
           a.self_assessment_completed_at,
           a.sprs_score, a.implements_all_17,
           a.carried_forward_from,
           a.material_change_reviewed_at, a.material_change_required_reassessment,
           a.material_change_details,
           a.sprs_filed_at, a.sprs_confirmation_number,
           a.sprs_status_date,
           a.sprs_attestation_hash, a.custodia_verification_id,
           a.created_at, a.updated_at,
           COUNT(cr.*) FILTER (WHERE cr.status != 'unanswered')::int AS answered,
           COUNT(cr.*)::int AS total
    FROM assessments a
    LEFT JOIN control_responses cr ON cr.assessment_id = a.id
    WHERE a.organization_id = ${organizationId}
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `) as Array<AssessmentRow & { answered: number; total: number }>;

  return Promise.all(
    rows.map(async (r) => ({
      ...(await decryptAssessmentSensitiveFields(r)),
      answered: r.answered,
      total: r.total,
      percentAnswered: r.total === 0 ? 0 : Math.round((r.answered / r.total) * 100),
    })),
  );
}

export async function createAssessmentForOrg(
  organizationId: string,
  cycleLabel: string,
  framework: Framework = "cmmc_l1",
  fiscalYear: number = fiscalYearOf(),
): Promise<AssessmentRow> {
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO assessments (organization_id, cycle_label, status, framework, fiscal_year)
    VALUES (${organizationId}, ${cycleLabel}, 'in_progress', ${framework}, ${fiscalYear})
    RETURNING id, organization_id, cycle_label, status, framework, fiscal_year,
              submitted_at, affirmed_at, affirmed_by_name, affirmed_by_title,
              affirming_official_email, self_assessment_completed_at,
              sprs_score, implements_all_17, carried_forward_from,
              material_change_reviewed_at, material_change_required_reassessment,
              material_change_details,
              sprs_filed_at, sprs_confirmation_number, sprs_status_date,
              sprs_attestation_hash, custodia_verification_id,
              created_at, updated_at
  `) as AssessmentRow[];
  const assessment = inserted[0];

  const controlIds = getPlaybookForFramework(framework).map((entry) => entry.id);
  await sql`
    INSERT INTO control_responses (assessment_id, control_id)
    SELECT ${assessment.id}::uuid, cid
    FROM UNNEST(${controlIds}::text[]) AS t(cid)
  `;

  // CMMC L1 v2.13 — also seed the per-objective response table so the user
  // can be evaluated against the 59 NIST 800-171A objectives that roll up
  // to the 15 v2.13 requirements (32 CFR § 170.24).
  if (framework === "cmmc_l1") {
    await seedObjectiveRows(assessment.id);
  }

  await seedMilestonesForAssessment(organizationId, assessment.id, fiscalYear);

  return assessment;
}

/**
 * Annual rollover: create a new cycle that imports the prior cycle's responses
 * and evidence artifacts as drafts pending user review. The user must walk
 * each carried row to "kept" or "needs_replacement" before it counts toward
 * the new cycle's evidence gate. Mirrors the "import last year's filing"
 * — most fields are stable year-over-year, but the user has to confirm.
 */
export async function createAssessmentWithCarryForward(
  organizationId: string,
  cycleLabel: string,
  framework: Framework,
  fiscalYear: number,
  priorAssessmentId: string,
): Promise<AssessmentRow> {
  const sql = getSql();

  const inserted = (await sql`
    INSERT INTO assessments
      (organization_id, cycle_label, status, framework, fiscal_year, carried_forward_from)
    VALUES
      (${organizationId}, ${cycleLabel}, 'in_progress', ${framework},
       ${fiscalYear}, ${priorAssessmentId}::uuid)
    RETURNING id, organization_id, cycle_label, status, framework, fiscal_year,
              submitted_at, affirmed_at, affirmed_by_name, affirmed_by_title,
              affirming_official_email, self_assessment_completed_at,
              sprs_score, implements_all_17, carried_forward_from,
              material_change_reviewed_at, material_change_required_reassessment,
              material_change_details,
              sprs_filed_at, sprs_confirmation_number, sprs_status_date,
              sprs_attestation_hash, custodia_verification_id,
              created_at, updated_at
  `) as AssessmentRow[];
  const assessment = inserted[0];

  // Carry forward responses: every prior response copied with status preserved
  // EXCEPT 'no' / 'partial' / 'unanswered' — those reset to 'unanswered' so
  // the user must re-answer this year. 'yes' / 'not_applicable' carry over
  // but flagged 'pending_review'.
  await sql`
    INSERT INTO control_responses
      (assessment_id, control_id, status, narrative, carry_forward_status)
    SELECT ${assessment.id}::uuid,
           prior.control_id,
           CASE WHEN prior.status IN ('yes','not_applicable')
                THEN prior.status
                ELSE 'unanswered'
           END,
           CASE WHEN prior.status IN ('yes','not_applicable')
                THEN prior.narrative
                ELSE NULL
           END,
           CASE WHEN prior.status IN ('yes','not_applicable')
                THEN 'pending_review'
                ELSE 'kept'
           END
    FROM control_responses prior
    WHERE prior.assessment_id = ${priorAssessmentId}::uuid
  `;

  // Backfill any practices that exist in the playbook but weren't in the prior
  // cycle (framework expansion). They start unanswered.
  const controlIds = getPlaybookForFramework(framework).map((entry) => entry.id);
  await sql`
    INSERT INTO control_responses (assessment_id, control_id)
    SELECT ${assessment.id}::uuid, cid
    FROM UNNEST(${controlIds}::text[]) AS t(cid)
    ON CONFLICT (assessment_id, control_id) DO NOTHING
  `;

  // CMMC L1 v2.13: per-objective seed for the new cycle. Carried-forward
  // status is intentionally NOT copied — every objective starts from
  // 'unanswered' so the user must re-confirm currency annually per
  // 32 CFR § 170.15(c)(2). The legacy `control_responses` carry-forward
  // gives Charlie context to pre-fill suggested answers.
  if (framework === "cmmc_l1") {
    await seedObjectiveRows(assessment.id);
  }

  // Carry forward evidence artifacts pointing to the same blob URLs. Each new
  // row gets prior_artifact_id set and carry_forward_status='pending_review'.
  // AI verdicts are reset to NULL — vision review re-runs against the new
  // cycle for currency.
  await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type, size_bytes,
       captured_at, uploaded_by_user_id, ai_suggested_controls,
       prior_artifact_id, carry_forward_status)
    SELECT ${assessment.id}::uuid, prior.control_id, prior.filename,
           prior.blob_url, prior.mime_type, prior.size_bytes,
           prior.captured_at, prior.uploaded_by_user_id,
           prior.ai_suggested_controls, prior.id, 'pending_review'
    FROM evidence_artifacts prior
    WHERE prior.assessment_id = ${priorAssessmentId}::uuid
      AND prior.carry_forward_status != 'removed'
  `;

  await seedMilestonesForAssessment(organizationId, assessment.id, fiscalYear);
  return assessment;
}

/**
 * Material-change interview (Scoping Guide L1 v2.13 § 170.19 p. 4). The four
 * canonical questions. If any answer is "yes" the prior cycle's responses
 * MUST be re-walked from scratch; an annual affirmation alone cannot
 * paper over a boundary change.
 */
export const materialChangeQuestionKeys = [
  "new_facilities",
  "merger_or_acquisition",
  "major_it_migration",
  "fci_handling_change",
] as const;
export type MaterialChangeQuestionKey =
  (typeof materialChangeQuestionKeys)[number];

export type MaterialChangeAnswers = Record<MaterialChangeQuestionKey, boolean>;

/**
 * Persist the material-change interview outcome on a carried-forward
 * assessment. When `requiredReassessment` is true (any "yes" answer) we
 * also wipe carried responses + carried evidence back to a clean slate so
 * the user must re-walk every requirement. When false (all "no") we record
 * the timestamp and rationale only — the carried draft stands.
 */
export async function recordMaterialChangeReview(args: {
  assessmentId: string;
  answers: MaterialChangeAnswers;
  rationale: string | null;
  requiredReassessment: boolean;
}): Promise<void> {
  const sql = getSql();
  const details = {
    answers: args.answers,
    rationale: args.rationale,
    recordedAt: new Date().toISOString(),
  };
  await sql`
    UPDATE assessments
    SET material_change_reviewed_at = NOW(),
        material_change_required_reassessment = ${args.requiredReassessment},
        material_change_details = ${JSON.stringify(details)}::jsonb
    WHERE id = ${args.assessmentId}::uuid
  `;
  if (args.requiredReassessment) {
    // Wipe carried responses back to unanswered and mark every carried
    // evidence artifact as needing replacement. A material change resets
    // the assessment-objective evidence baseline (32 CFR § 170.15).
    await sql`
      UPDATE control_responses
      SET status = 'unanswered',
          narrative = NULL,
          carry_forward_status = 'needs_replacement'
      WHERE assessment_id = ${args.assessmentId}::uuid
    `;
    await sql`
      UPDATE evidence_artifacts
      SET carry_forward_status = 'needs_replacement'
      WHERE assessment_id = ${args.assessmentId}::uuid
        AND carry_forward_status != 'removed'
    `;
  }
}

export async function getAssessmentForUser(
  assessmentId: string,
  userId: string,
): Promise<{ assessment: AssessmentRow; organization: OrganizationRow } | null> {
  // Every assessment-area server component begins here, so this is the
  // single chokepoint that guarantees the schema migration (including the
  // PR1 evidence_artifact_practices join table) has run on this lambda
  // instance before any downstream read tries to JOIN against it. Cached
  // by ensureDbReady so it's a no-op after the first call per cold start.
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id AS a_id, a.organization_id, a.cycle_label, a.status AS a_status,
           a.framework, a.fiscal_year,
           a.submitted_at, a.affirmed_at, a.affirmed_by_name, a.affirmed_by_title,
           a.affirming_official_email, a.self_assessment_completed_at,
           a.sprs_score, a.implements_all_17, a.carried_forward_from,
           a.material_change_reviewed_at, a.material_change_required_reassessment,
           a.material_change_details,
           a.sprs_filed_at, a.sprs_confirmation_number, a.sprs_status_date,
           a.sprs_attestation_hash, a.custodia_verification_id,
           a.created_at AS a_created_at, a.updated_at AS a_updated_at,
           o.id AS o_id, o.owner_user_id, o.clerk_org_id, o.name AS o_name, o.entity_type,
           o.cage_code, o.sam_uei, o.naics_codes, o.tier, o.scoped_systems,
           o.senior_official_user_id, o.senior_official_acknowledged_at,
           o.created_at AS o_created_at, o.updated_at AS o_updated_at
    FROM assessments a
    JOIN organizations o ON o.id = a.organization_id
    WHERE a.id = ${assessmentId} AND o.owner_user_id = ${userId}
    LIMIT 1
  `) as Array<Record<string, unknown>>;

  if (rows.length === 0) return null;
  const r = rows[0];

  const orgIdValue = r.organization_id as string;
  const [decAffirmedName, decAffirmedTitle] = await Promise.all([
    tryDecryptField(
      (r.affirmed_by_name as string | null) ?? null,
      { organizationId: orgIdValue, field: "assessments.affirmed_by_name" },
    ),
    tryDecryptField(
      (r.affirmed_by_title as string | null) ?? null,
      { organizationId: orgIdValue, field: "assessments.affirmed_by_title" },
    ),
  ]);
  return {
    assessment: {
      id: r.a_id as string,
      organization_id: orgIdValue,
      cycle_label: r.cycle_label as string,
      status: r.a_status as AssessmentStatus,
      framework: r.framework as Framework,
      fiscal_year: r.fiscal_year as number,
      submitted_at: r.submitted_at as string | null,
      affirmed_at: r.affirmed_at as string | null,
      affirmed_by_name: decAffirmedName,
      affirmed_by_title: decAffirmedTitle,
      affirming_official_email: r.affirming_official_email as string | null,
      self_assessment_completed_at:
        r.self_assessment_completed_at as string | null,
      sprs_score: r.sprs_score as number | null,
      implements_all_17: r.implements_all_17 as boolean | null,
      carried_forward_from: r.carried_forward_from as string | null,
      material_change_reviewed_at:
        r.material_change_reviewed_at as string | null,
      material_change_required_reassessment:
        r.material_change_required_reassessment as boolean | null,
      material_change_details:
        (r.material_change_details as Record<string, unknown> | null) ?? null,
      sprs_filed_at: r.sprs_filed_at as string | null,
      sprs_confirmation_number: r.sprs_confirmation_number as string | null,
      sprs_status_date: r.sprs_status_date as string | null,
      sprs_attestation_hash: r.sprs_attestation_hash as string | null,
      custodia_verification_id: r.custodia_verification_id as string | null,
      created_at: r.a_created_at as string,
      updated_at: r.a_updated_at as string,
    },
    organization: {
      id: r.o_id as string,
      owner_user_id: r.owner_user_id as string,
      clerk_org_id: (r.clerk_org_id as string | null) ?? null,
      name: r.o_name as string,
      entity_type: r.entity_type as string | null,
      cage_code: r.cage_code as string | null,
      sam_uei: r.sam_uei as string | null,
      naics_codes: (r.naics_codes as string[]) ?? [],
      tier: r.tier as OrganizationRow["tier"],
      scoped_systems: r.scoped_systems as string | null,
      senior_official_user_id:
        (r.senior_official_user_id as string | null) ?? null,
      senior_official_acknowledged_at:
        (r.senior_official_acknowledged_at as string | null) ?? null,
      created_at: r.o_created_at as string,
      updated_at: r.o_updated_at as string,
    },
  };
}

export async function listResponsesForAssessment(
  assessmentId: string,
): Promise<ControlResponseRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId}
    ORDER BY control_id
  `) as ControlResponseRow[];
}

export type EvidenceArtifactRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  filename: string;
  blob_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  captured_at: string;
  uploaded_by_user_id: string;
  ai_review_verdict: EvidenceVerdict | null;
  ai_review_summary: string | null;
  ai_review_mapped_controls: string[];
  ai_reviewed_at: string | null;
  ai_review_model: string | null;
  prior_artifact_id: string | null;
  carry_forward_status: CarryForwardStatus;
  /** Final-policy adoption (CMMC AG L1 v2.13 p. 7 "final forms" rule). When
   *  is_final_policy is true, the artifact is treated as MET regardless of
   *  the AI vision verdict, and the SSP renders an adoption disclosure. */
  is_final_policy: boolean;
  final_adopted_at: string | null;
  final_adopted_by: string | null;
  /** CMMC AG L1 v2.13 §§ 5–7: which assessment method this artifact
   *  satisfies (examine = policy/screenshot/config; interview = role
   *  attestation / Q&A; test = demo / screen recording). Optional. */
  assessment_method: "examine" | "interview" | "test" | null;
  /**
   * NIST 800-171A objective letters this artifact is tagged to FOR THE
   * CURRENT QUERY's practice. Empty array means "tagged to the practice as
   * a whole" (legacy behaviour). Only populated by `listEvidenceForControl`.
   */
  tagged_objectives: string[];
  /**
   * Connector provenance (null for human uploads). When set, the artifact
   * was auto-pulled from a system of record and `data_hash` is the
   * SHA-256 of the raw bytes — recompute and compare to verify integrity.
   */
  source_provider: string | null;
  source_kind: string | null;
  source_run_id: string | null;
  data_hash: string | null;
  synced_at: string | null;
};

/**
 * List every artifact tagged to (assessmentId, controlId) — including
 * artifacts that were originally uploaded under a DIFFERENT practice but
 * have since been cross-tagged via `evidence_artifact_practices`. The
 * legacy `evidence_artifacts.control_id` column is treated as just one
 * tag among many; cross-tags from the join table are unioned in.
 */
export async function listEvidenceForControl(
  assessmentId: string,
  controlId: string,
): Promise<EvidenceArtifactRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT a.id, a.assessment_id, a.control_id, a.filename, a.blob_url,
           a.mime_type, a.size_bytes, a.captured_at, a.uploaded_by_user_id,
           a.ai_review_verdict, a.ai_review_summary, a.ai_review_mapped_controls,
           a.ai_reviewed_at, a.ai_review_model,
           a.prior_artifact_id, a.carry_forward_status,
           a.is_final_policy, a.final_adopted_at, a.final_adopted_by,
           a.assessment_method,
           a.source_provider, a.source_kind, a.source_run_id,
           a.data_hash, a.synced_at,
           COALESCE(eap.objectives, '{}'::text[]) AS tagged_objectives
    FROM evidence_artifacts a
    LEFT JOIN evidence_artifact_practices eap
      ON eap.artifact_id = a.id
     AND eap.assessment_id = ${assessmentId}
     AND eap.control_id = ${controlId}
    WHERE a.assessment_id = ${assessmentId}
      AND (
        a.control_id = ${controlId}
        OR eap.artifact_id IS NOT NULL
      )
    ORDER BY a.captured_at DESC
  `) as EvidenceArtifactRow[];
}

export async function listEvidenceForAssessment(
  assessmentId: string,
): Promise<EvidenceArtifactRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT a.id, a.assessment_id, a.control_id, a.filename, a.blob_url, a.mime_type,
           a.size_bytes, a.captured_at, a.uploaded_by_user_id,
           a.ai_review_verdict, a.ai_review_summary, a.ai_review_mapped_controls,
           a.ai_reviewed_at, a.ai_review_model,
           a.prior_artifact_id, a.carry_forward_status,
           a.is_final_policy, a.final_adopted_at, a.final_adopted_by,
           a.assessment_method,
           a.source_provider, a.source_kind, a.source_run_id,
           a.data_hash, a.synced_at,
           -- Aggregate objective letters across every (practice) tag this
           -- artifact has within this assessment. Per CMMC Assessment Guide
           -- L1 v2.13 section 2, each requirement has 1-6 NIST SP 800-171A
           -- objectives (a/b/c/...); we tag at the objective level on the
           -- join so the evidence inventory CSV can show exactly which
           -- objectives an artifact attests to (audit traceability beyond
           -- a coarse practice tag). When no tags exist (legacy artifacts
           -- uploaded before per-objective tagging) the column is empty,
           -- and the artifact still rolls up to its primary control_id
           -- for status purposes.
           COALESCE(
             (SELECT array_agg(DISTINCT obj ORDER BY obj)
              FROM evidence_artifact_practices eap
              CROSS JOIN LATERAL UNNEST(eap.objectives) AS obj
              WHERE eap.artifact_id = a.id
                AND eap.assessment_id = a.assessment_id),
             '{}'::text[]
           ) AS tagged_objectives
    FROM evidence_artifacts a
    WHERE a.assessment_id = ${assessmentId}
    ORDER BY a.control_id, a.captured_at DESC
  `) as EvidenceArtifactRow[];
}

/**
 * Tag an existing artifact to a (practice, objectives[]) tuple. Idempotent:
 * subsequent calls with the same (artifact, practice) update the objectives
 * list. Returns true if a row was inserted or updated.
 */
export async function tagArtifactPractice(args: {
  artifactId: string;
  assessmentId: string;
  controlId: string;
  objectives: string[];
  userId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO evidence_artifact_practices
      (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
    VALUES
      (${args.artifactId}, ${args.assessmentId}, ${args.controlId},
       ${args.objectives}, ${args.userId})
    ON CONFLICT (artifact_id, assessment_id, control_id)
    DO UPDATE SET objectives = EXCLUDED.objectives
  `;
}

/**
 * Remove a (practice) tag from an artifact. Used when the user un-tags an
 * artifact they had previously cross-tagged. Does NOT delete the artifact
 * itself or its primary `evidence_artifacts.control_id` association.
 */
export async function untagArtifactPractice(args: {
  artifactId: string;
  assessmentId: string;
  controlId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM evidence_artifact_practices
    WHERE artifact_id = ${args.artifactId}
      AND assessment_id = ${args.assessmentId}
      AND control_id = ${args.controlId}
  `;
}

export type ReuseCandidate = EvidenceArtifactRow & {
  /** True if Charlie's prior vision review mapped this artifact to the
   * target control, i.e. it's a confident suggestion rather than just
   * "anything in the assessment". */
  suggested: boolean;
  /** The practice this artifact was originally uploaded for, used as the
   * grouping label in the picker. */
  source_control_id: string;
};

/**
 * Artifacts in this assessment that are NOT yet tagged to `controlId` and
 * could plausibly be reused. We surface every other-practice artifact so the
 * user always has the option, then sort suggested ones (where the AI vision
 * review already mapped the file to this control) to the top.
 */
export async function getReuseCandidates(
  assessmentId: string,
  controlId: string,
): Promise<ReuseCandidate[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT a.id, a.assessment_id, a.control_id, a.filename, a.blob_url,
           a.mime_type, a.size_bytes, a.captured_at, a.uploaded_by_user_id,
           a.ai_review_verdict, a.ai_review_summary, a.ai_review_mapped_controls,
           a.ai_reviewed_at, a.ai_review_model,
           a.prior_artifact_id, a.carry_forward_status,
           a.is_final_policy, a.final_adopted_at, a.final_adopted_by,
           a.assessment_method,
           a.source_provider, a.source_kind, a.source_run_id,
           a.data_hash, a.synced_at,
           '{}'::text[] AS tagged_objectives,
           a.control_id AS source_control_id
    FROM evidence_artifacts a
    WHERE a.assessment_id = ${assessmentId}
      AND a.control_id <> ${controlId}
      AND NOT EXISTS (
        SELECT 1 FROM evidence_artifact_practices eap
        WHERE eap.artifact_id = a.id
          AND eap.assessment_id = ${assessmentId}
          AND eap.control_id = ${controlId}
      )
    ORDER BY a.captured_at DESC
  `) as Array<EvidenceArtifactRow & { source_control_id: string }>;
  return rows.map((r) => ({
    ...r,
    suggested:
      Array.isArray(r.ai_review_mapped_controls) &&
      r.ai_review_mapped_controls.includes(controlId),
  }));
}

/**
 * An artifact counts toward attestation readiness only if the AI vision review
 * actually reviewed it AND rendered a non-insufficient, non-not_relevant
 * verdict. See feedback_evidence_gating.md.
 *
 * Verdicts of `unclear` with `ai_review_model = 'none'` are reserved for
 * unsupported formats (CSV, Excel, Word, plain text) — those bypass the AI
 * entirely and would otherwise leak through the gate. We treat them as not
 * passing so the user is forced to re-upload as a screenshot or PDF (or wait
 * for an officer to manually clear them).
 */
export function isEvidencePassing(row: EvidenceArtifactRow): boolean {
  // Final-policy override (CMMC AG L1 v2.13 p. 7): the user has formally
  // adopted this artifact as a policy of record, naming the adopter and
  // adoption date. This is the documented escape hatch from the AI vision
  // gate — a draft that has been promoted to final "counts."
  if (row.is_final_policy) return true;
  if (row.ai_review_verdict === "sufficient") return true;
  if (row.ai_review_verdict === "unclear" && row.ai_review_model !== "none") {
    return true;
  }
  return false;
}

export function evidenceReviewBlockers(
  rows: EvidenceArtifactRow[],
): Array<{ id: string; filename: string; reason: string }> {
  return rows
    .filter((r) => !isEvidencePassing(r))
    .map((r) => ({
      id: r.id,
      filename: r.filename,
      reason:
        r.ai_review_verdict === null
          ? "Pending Platform review"
          : r.ai_review_model === "none"
            ? "Format not auto-reviewable — re-upload as PNG, JPG, or PDF"
            : r.ai_review_verdict === "insufficient"
              ? "Platform flagged insufficient — replace or supplement"
              : r.ai_review_verdict === "not_relevant"
                ? "Platform could not map this artifact to any practice"
                : "Not passing",
    }));
}

export async function getResponse(
  assessmentId: string,
  controlId: string,
): Promise<ControlResponseRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    LIMIT 1
  `) as ControlResponseRow[];
  if (rows[0]) return rows[0];
  // Self-heal: a missing control_responses row used to 404 the control
  // page. That happened to any assessment that ran an early hardReset
  // before we switched to UPSERT semantics. If the controlId is valid in
  // any framework's playbook we re-seed the default row so the page can
  // render — the assessment isn't broken, just under-seeded.
  const seeded = (await sql`
    INSERT INTO control_responses (assessment_id, control_id, status)
    VALUES (${assessmentId}, ${controlId}, 'unanswered')
    ON CONFLICT (assessment_id, control_id) DO NOTHING
    RETURNING id, assessment_id, control_id, status, narrative, officer_reviewed,
              officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
              updated_at
  `) as ControlResponseRow[];
  if (seeded[0]) return seeded[0];
  // Lost the race; re-read.
  const re = (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    LIMIT 1
  `) as ControlResponseRow[];
  return re[0] ?? null;
}

/**
 * Identifies practices marked "Met" that have no passing evidence on file.
 * CMMC L1 self-attestation does not legally require uploaded artifacts, but
 * a bid-ready package without proof is worthless to a prime — and a signer
 * who claims "Met" with zero evidence is one questionnaire away from
 * embarrassment. We treat this as a sign-time blocker. The user can override
 * by writing an explicit narrative justifying why no artifact applies.
 *
 * A response satisfies the gate if EITHER:
 *   - status is 'not_applicable' (N/A practices need no artifact)
 *   - status is 'unanswered'/'no'/'partial' (other gates fire first)
 *   - status is 'yes' AND it has at least one passing artifact
 *   - status is 'yes' AND the narrative contains an explicit no-evidence
 *     justification (>=200 chars including the phrase 'no artifact')
 */
export function controlsMissingEvidence(
  responses: ControlResponseRow[],
  evidence: EvidenceArtifactRow[],
): Array<{ control_id: string; reason: string }> {
  const passingByControl = new Map<string, number>();
  for (const e of evidence) {
    if (!isEvidencePassing(e)) continue;
    if (e.carry_forward_status === "pending_review") continue;
    if (e.carry_forward_status === "needs_replacement") continue;
    if (e.carry_forward_status === "removed") continue;
    passingByControl.set(
      e.control_id,
      (passingByControl.get(e.control_id) ?? 0) + 1,
    );
  }

  const missing: Array<{ control_id: string; reason: string }> = [];
  for (const r of responses) {
    if (r.status !== "yes") continue;
    const count = passingByControl.get(r.control_id) ?? 0;
    if (count > 0) continue;
    const narrative = (r.narrative ?? "").trim();
    const hasJustification =
      narrative.length >= 200 && /no artifact/i.test(narrative);
    if (hasJustification) continue;
    missing.push({
      control_id: r.control_id,
      reason:
        "Marked Met but has no passing evidence on file. Upload an artifact or write a narrative (200+ chars including 'no artifact') explaining why none applies.",
    });
  }
  return missing;
}

/**
 * Practices marked `not_applicable` that lack a written justification.
 *
 * CMMC AG L1 v2.13 p. 8 frames N/A this way:
 *   "SC.L1-b.1.xi might be N/A if there are no publicly accessible systems
 *   within the CMMC Assessment Scope. During an assessment, an assessment
 *   objective assessed as N/A is equivalent to the same assessment
 *   objective being assessed as MET."
 *
 * The SSP must therefore justify each N/A — otherwise a contracting
 * officer can't tell "MET via N/A" from "the user clicked the wrong
 * radio." Require a narrative of at least 120 chars on every N/A response
 * before allowing sign-time.
 *
 * 120 chars is shorter than the `no artifact` justification threshold
 * (200 chars) because the N/A reason is typically a single environmental
 * fact ("no publicly accessible systems in scope") rather than an
 * affirmative claim that needs evidence-equivalent description.
 */
export function controlsMissingNaJustification(
  responses: ControlResponseRow[],
): Array<{ control_id: string; reason: string }> {
  const out: Array<{ control_id: string; reason: string }> = [];
  for (const r of responses) {
    if (r.status !== "not_applicable") continue;
    const narrative = (r.narrative ?? "").trim();
    if (narrative.length >= 120) continue;
    out.push({
      control_id: r.control_id,
      reason:
        "Marked Not Applicable but the justification is too short. Write at least 120 characters explaining why this requirement doesn't apply to your CMMC Assessment Scope (CMMC AG L1 v2.13 p. 8).",
    });
  }
  return out;
}

/**
 * Suggested N/A justifications. CMMC AG L1 v2.13 p. 8 requires every N/A
 * to carry a narrative — but the universe of plausible reasons is tiny
 * and well-known. Surface a starter sentence the user can edit instead
 * of staring at an empty box. Returns null when the control has no
 * canonical N/A pattern (force the user to write from scratch).
 */
export function suggestedNaJustification(controlId: string): string | null {
  const map: Record<string, string> = {
    // SC.L1-b.1.xi — Public-access boundary. Many small shops have no
    // public-facing systems in scope (no website that holds FCI, no
    // public ingress to FCI-bearing systems).
    "SC.L1-b.1.xi":
      "No publicly accessible systems are within the CMMC Assessment Scope. Federal Contract Information (FCI) is processed and stored only in private, authenticated systems; the company has no public-facing application, web portal, or self-service interface that holds, transmits, or receives FCI. Public marketing pages (e.g., the company website) are operationally and logically separated from any FCI-bearing system.",
    // PE.L1-b.1.ix — Visitor escort / physical access logs. Common for
    // 100% remote / no-office shops with no employer-controlled facility.
    "PE.L1-b.1.ix":
      "The company operates as a fully remote organization with no employer-controlled physical facility where Federal Contract Information (FCI) is processed, stored, or transmitted. There is no office, server room, or shared workspace that hosts FCI-bearing systems, and therefore no facility-level visitor population to escort or log. Endpoint physical security at remote worker locations is addressed under PE.L1-b.1.viii.",
    // PE.L1-b.1.viii — Physical access controls to facilities. Same
    // remote-only rationale; endpoints carry the physical-protection
    // weight at the individual worker location.
    "PE.L1-b.1.viii":
      "The company operates as a fully remote organization with no employer-controlled physical facility containing FCI-bearing systems. Physical protection is enforced at the endpoint level: company-issued laptops are full-disk-encrypted, screen-locked when unattended, and stored securely at remote worker locations. There is no facility access control system because there is no facility within the assessment scope.",
  };
  return map[controlId] ?? null;
}

/**
 * Practices that need a remediation plan: any 'no' or 'partial' response.
 * Returns control IDs for the caller to surface in the UI. Sign-time gate
 * remains hard — partial/no still blocks affirmation — but this exposes the
 * roadmap in a structured way for prime questionnaires.
 */
export function controlsNeedingRemediation(
  responses: ControlResponseRow[],
): string[] {
  return responses
    .filter((r) => r.status === "no" || r.status === "partial")
    .map((r) => r.control_id);
}

export async function listRemediationPlansForAssessment(
  assessmentId: string,
): Promise<RemediationPlanRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, assessment_id, control_id, gap_summary, planned_actions,
           target_close_date::text AS target_close_date, status,
           created_at, updated_at, closed_at
    FROM remediation_plans
    WHERE assessment_id = ${assessmentId}
    ORDER BY target_close_date ASC, control_id ASC
  `) as RemediationPlanRow[];
}

export async function getRemediationPlan(
  assessmentId: string,
  controlId: string,
): Promise<RemediationPlanRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, control_id, gap_summary, planned_actions,
           target_close_date::text AS target_close_date, status,
           created_at, updated_at, closed_at
    FROM remediation_plans
    WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    LIMIT 1
  `) as RemediationPlanRow[];
  return rows[0] ?? null;
}

export async function upsertRemediationPlan(input: {
  assessmentId: string;
  controlId: string;
  gapSummary: string;
  plannedActions: string;
  targetCloseDate: string;
  status: RemediationStatus;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO remediation_plans
      (assessment_id, control_id, gap_summary, planned_actions,
       target_close_date, status, updated_at)
    VALUES
      (${input.assessmentId}::uuid, ${input.controlId},
       ${input.gapSummary}, ${input.plannedActions},
       ${input.targetCloseDate}::date, ${input.status}, NOW())
    ON CONFLICT (assessment_id, control_id) DO UPDATE
    SET gap_summary = EXCLUDED.gap_summary,
        planned_actions = EXCLUDED.planned_actions,
        target_close_date = EXCLUDED.target_close_date,
        status = EXCLUDED.status,
        updated_at = NOW(),
        closed_at = CASE
          WHEN EXCLUDED.status IN ('closed','abandoned')
            AND remediation_plans.closed_at IS NULL
            THEN NOW()
          WHEN EXCLUDED.status NOT IN ('closed','abandoned')
            THEN NULL
          ELSE remediation_plans.closed_at
        END
  `;
}

export async function deleteRemediationPlan(
  assessmentId: string,
  controlId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM remediation_plans
    WHERE assessment_id = ${assessmentId}::uuid AND control_id = ${controlId}
  `;
}

/**
 * Carry-forward decisions on imported responses + artifacts during annual
 * rollover review. The rollover step seeds rows as 'pending_review'; the user
 * walks through and marks each as 'kept', 'needs_replacement', or 'removed'.
 */
export async function setResponseCarryStatus(
  assessmentId: string,
  controlId: string,
  status: CarryForwardStatus,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE control_responses
    SET carry_forward_status = ${status}, updated_at = NOW()
    WHERE assessment_id = ${assessmentId}::uuid AND control_id = ${controlId}
  `;
}

export async function setArtifactCarryStatus(
  artifactId: string,
  status: CarryForwardStatus,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET carry_forward_status = ${status}
    WHERE id = ${artifactId}::uuid
  `;
}

/**
 * Items still pending user review during a rollover cycle. UI uses this to
 * drive the "review last year's work" panel on the assessment overview.
 */
export async function listCarryForwardPending(
  assessmentId: string,
): Promise<{
  responses: ControlResponseRow[];
  artifacts: EvidenceArtifactRow[];
}> {
  const sql = getSql();
  const responses = (await sql`
    SELECT id, assessment_id, control_id, status, narrative, officer_reviewed,
           officer_reviewed_at, officer_reviewer_user_id, carry_forward_status,
           updated_at
    FROM control_responses
    WHERE assessment_id = ${assessmentId}::uuid
      AND carry_forward_status = 'pending_review'
    ORDER BY control_id
  `) as ControlResponseRow[];
  const artifacts = (await sql`
    SELECT id, assessment_id, control_id, filename, blob_url, mime_type,
           size_bytes, captured_at, uploaded_by_user_id,
           ai_review_verdict, ai_review_summary, ai_review_mapped_controls,
           ai_reviewed_at, ai_review_model,
           prior_artifact_id, carry_forward_status,
           is_final_policy, final_adopted_at, final_adopted_by,
           assessment_method,
           source_provider, source_kind, source_run_id,
           data_hash, synced_at,
           '{}'::text[] AS tagged_objectives
    FROM evidence_artifacts
    WHERE assessment_id = ${assessmentId}::uuid
      AND carry_forward_status = 'pending_review'
    ORDER BY control_id, captured_at DESC
  `) as EvidenceArtifactRow[];
  return { responses, artifacts };
}

export type ProgressBreakdown = {
  total: number;
  met: number;
  partial: number;
  notMet: number;
  notApplicable: number;
  unanswered: number;
  percentAnswered: number;
};

export function computeProgress(responses: ControlResponseRow[]): ProgressBreakdown {
  // Roll up legacy NIST 800-171 r2 control rows to the 15 CMMC L1 v2.13
  // requirement IDs (FAR 52.204-21(b)(1)(i)–(b)(1)(xv)). Several legacy
  // practices (PE 3.10.3, 3.10.4, 3.10.5) collapse into a single requirement
  // (PE.L1-b.1.ix), so the user-facing count is 15, not 17. Per 32 CFR
  // § 170.24, a requirement is MET only when every constituent practice is
  // MET or N/A; one NOT MET fails the requirement.
  const groups = new Map<string, ControlResponseRow["status"][]>();
  for (const r of responses) {
    const groupKey = playbookById[r.control_id]?.requirementId ?? r.control_id;
    const list = groups.get(groupKey);
    if (list) list.push(r.status);
    else groups.set(groupKey, [r.status]);
  }

  const total = groups.size;
  let met = 0,
    partial = 0,
    notMet = 0,
    notApplicable = 0,
    unanswered = 0;
  for (const statuses of groups.values()) {
    if (statuses.includes("no")) notMet++;
    else if (statuses.includes("partial")) partial++;
    else if (statuses.includes("unanswered")) unanswered++;
    else if (statuses.includes("yes")) met++;
    else notApplicable++;
  }
  const answered = total - unanswered;
  return {
    total,
    met,
    partial,
    notMet,
    notApplicable,
    unanswered,
    percentAnswered: total === 0 ? 0 : Math.round((answered / total) * 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step ordering — single source of truth for which sections of /assessments/[id]
// are unlocked. The user must complete each step in order:
//
//   1. profile        — business profile captured + scoped_systems paragraph
//   2. registration   — Unique Entity ID + at least one NAICS code on file
//                       (CAGE is collected here too, but it can arrive later —
//                       SAM.gov issues UEI instantly while DLA takes a few
//                       days to assign CAGE. We remind the user to come back
//                       and paste it once they receive it.)
//   3. practices      — all 15 v2.13 requirement rollups MET (every NIST
//                       800-171A objective MET or NOT APPLICABLE; 32 CFR
//                       § 170.24)
//   4. sign           — senior official signs the affirmation
//   5. attested       — bid packet, deliverables, etc. unlocked
//
// Every page under /assessments/[id]/* must call enforceStepOrder() at the top
// so a user who hand-types a future URL bounces back to their current step.
// ─────────────────────────────────────────────────────────────────────────────

export type AssessmentStep =
  | "profile"
  | "registration"
  | "material-change"
  | "scope"
  | "practices"
  | "sign"
  | "attested";

const STEP_ORDER: AssessmentStep[] = [
  "profile",
  "registration",
  "material-change",
  "scope",
  "practices",
  "sign",
  "attested",
];

export type StepGate = {
  profileComplete: boolean;
  registrationComplete: boolean;
  /**
   * For carry-forward cycles: true once the Senior Official has answered
   * the Scoping Guide § 170.19 material-change interview. Always true on
   * a fresh (non-carried) assessment.
   */
  materialChangeReviewed: boolean;
  /**
   * 32 CFR § 170.19(b)(3) scope inventory minimum: at least one People,
   * Technology, Facility, and ESP row on file. Defaults to true for
   * frameworks other than CMMC L1 so this gate is a no-op there.
   */
  scopeComplete: boolean;
  practicesComplete: boolean;
  attested: boolean;
  /** The earliest step the user has not finished. Where they should go next. */
  currentStep: AssessmentStep;
};

/**
 * Profile is "step 1 complete" when the legal name is set, a scoped_systems
 * paragraph is on file, and the business profile completeness score is at
 * least 60 (the same bar the layout's sidebar uses).
 */
function isProfileStepComplete(
  org: OrganizationRow,
  profile: BusinessProfileRow | null,
): boolean {
  return (
    org.name.trim().length > 0 &&
    org.name !== "My Organization" &&
    (org.scoped_systems ?? "").trim().length > 0 &&
    (profile?.completeness_score ?? 0) >= 60
  );
}

function isRegistrationStepComplete(org: OrganizationRow): boolean {
  // CAGE code is intentionally NOT required to advance: when a contractor
  // submits an "All Awards" SAM.gov registration for the first time, the UEI
  // is issued immediately but the CAGE code takes 3–10 business days to come
  // back from the Defense Logistics Agency. We unlock the next step on UEI +
  // at least one NAICS code and prompt the user to come back and add the
  // CAGE when it arrives.
  return Boolean(
    (org.sam_uei ?? "").trim().length > 0 && org.naics_codes.length > 0,
  );
}

export function getStepGate(
  org: OrganizationRow,
  profile: BusinessProfileRow | null,
  responses: ControlResponseRow[],
  assessment: AssessmentRow,
  /**
   * Optional set of control IDs that are NOT MET / Partial in the legacy
   * `responses` view but are covered by a valid Enduring Exception or
   * Temporary Deficiency in the v2.13 objectives table. When present, those
   * controls are treated as MET-equivalent for the practicesComplete gate.
   */
  exceptionCoveredControlIds?: ReadonlySet<string>,
  /**
   * 32 CFR § 170.19(b)(3) scope inventory completeness. Pass `true` when the
   * org has at least one People, Technology, Facility, and ESP row. Omit
   * (defaults to `true`) for non-CMMC frameworks or callers that do not
   * gate on scope.
   */
  scopeComplete: boolean = true,
): StepGate {
  const profileComplete = isProfileStepComplete(org, profile);
  const registrationComplete = isRegistrationStepComplete(org);
  // Carry-forward cycles require an explicit "material change" interview
  // (Scoping Guide L1 v2.13 § 170.19 p. 4) before the user can walk the
  // carried responses. Fresh assessments skip this step entirely.
  const materialChangeReviewed =
    assessment.carried_forward_from === null ||
    assessment.material_change_reviewed_at !== null;
  const progress = computeProgress(responses);
  const blockingPartial = responses.filter(
    (r) =>
      (r.status === "no" || r.status === "partial") &&
      !(exceptionCoveredControlIds?.has(r.control_id) ?? false),
  ).length;
  const practicesComplete =
    progress.unanswered === 0 &&
    blockingPartial === 0 &&
    progress.total > 0;
  const attested = assessment.status === "attested";

  let currentStep: AssessmentStep = "attested";
  if (!profileComplete) currentStep = "profile";
  else if (!registrationComplete) currentStep = "registration";
  else if (!materialChangeReviewed) currentStep = "material-change";
  else if (!scopeComplete) currentStep = "scope";
  else if (!practicesComplete) currentStep = "practices";
  else if (!attested) currentStep = "sign";

  return {
    profileComplete,
    registrationComplete,
    materialChangeReviewed,
    scopeComplete,
    practicesComplete,
    attested,
    currentStep,
  };
}

/**
 * Map a step to its canonical page path under /assessments/[id]. The
 * "practices" step lives on the assessment overview page.
 */
export function stepHref(assessmentId: string, step: AssessmentStep): string {
  switch (step) {
    case "profile":
      return `/assessments/${assessmentId}/profile`;
    case "registration":
      return `/assessments/${assessmentId}/registration`;
    case "material-change":
      return `/assessments/${assessmentId}/material-change`;
    case "scope":
      return `/assessments/${assessmentId}/scope`;
    case "practices":
      return `/assessments/${assessmentId}`;
    case "sign":
      return `/assessments/${assessmentId}/sign`;
    case "attested":
      // Anything attested-gated lands on the overview by default.
      return `/assessments/${assessmentId}`;
  }
}

/**
 * Returns the redirect target if `requestedStep` is past the user's current
 * unlocked step. Returns null when the requested step is allowed (current or
 * any earlier completed step — users may revisit prior steps).
 */
export function stepGateRedirect(
  gate: StepGate,
  assessmentId: string,
  requestedStep: AssessmentStep,
): string | null {
  const requestedIdx = STEP_ORDER.indexOf(requestedStep);
  const currentIdx = STEP_ORDER.indexOf(gate.currentStep);
  if (requestedIdx <= currentIdx) return null;
  return stepHref(assessmentId, gate.currentStep);
}

/**
 * Server-side step gate. Call at the top of every page under
 * /assessments/[id]/* AFTER getAssessmentForUser. Loads the profile +
 * responses, computes the gate, and redirects the user back to their
 * current step if they're trying to skip ahead. Always returns the gate
 * for the caller's own use (e.g. to render different UI when attested).
 *
 * Note: pages that are step 1 ("profile") never need to call this since
 * profile is always reachable. Pages for "registration" and beyond should
 * always call it.
 */
export async function enforceStepOrder(
  ctx: { assessment: AssessmentRow; organization: OrganizationRow },
  requestedStep: AssessmentStep,
): Promise<StepGate> {
  const [profile, responses] = await Promise.all([
    getBusinessProfile(ctx.organization.id),
    listResponsesForAssessment(ctx.assessment.id),
  ]);
  // Load v2.13 EE/TD coverage so practices marked Not Met / Partial in the
  // legacy table can still pass the practices-complete gate when properly
  // documented. CMMC L1 only — other frameworks use the legacy gate as-is.
  let coverage: ReadonlySet<string> | undefined;
  let scopeComplete = true;
  if (ctx.assessment.framework === "cmmc_l1") {
    const [{ computeExceptionCoverage }, { listScopeItems, listEsps }] =
      await Promise.all([
        import("@/lib/cmmc/objectives"),
        import("@/lib/cmmc/scope"),
      ]);
    const [map, scopeItems, esps] = await Promise.all([
      computeExceptionCoverage(ctx.assessment.id),
      listScopeItems(ctx.organization.id),
      listEsps(ctx.organization.id),
    ]);
    const covered = new Set<string>();
    for (const [controlId, info] of map) {
      if (info.covered) covered.add(controlId);
    }
    coverage = covered;
    // 32 CFR § 170.19(b)(3) scope inventory: at least one row in each of
    // People, Technology, Facility, and ESP. Matches CourseLayout.
    const hasPeople = scopeItems.some((s) => s.kind === "people");
    const hasTech = scopeItems.some((s) => s.kind === "technology");
    const hasFacility = scopeItems.some((s) => s.kind === "facility");
    const hasEsp = esps.length > 0;
    scopeComplete = hasPeople && hasTech && hasFacility && hasEsp;
  }
  const gate = getStepGate(
    ctx.organization,
    profile,
    responses,
    ctx.assessment,
    coverage,
    scopeComplete,
  );
  const target = stepGateRedirect(gate, ctx.assessment.id, requestedStep);
  if (target) redirect(target);
  return gate;
}
