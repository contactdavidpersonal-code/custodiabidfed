import { neon } from "@neondatabase/serverless";
import { validateEnvOnce } from "@/lib/security/env";

export const sprintStages = [
  "lead-intake",
  "sam-registration",
  "ssp-draft",
  "controls-implementation",
  "evidence-review",
  "bid-ready",
  "retainer",
] as const;

export type SprintStage = (typeof sprintStages)[number];

export const orgTiers = ["solo", "bootcamp", "command"] as const;
export type OrgTier = (typeof orgTiers)[number];

export const assessmentStatuses = [
  "in_progress",
  "officer_review",
  "customer_review",
  "attested",
  "archived",
] as const;
export type AssessmentStatus = (typeof assessmentStatuses)[number];

export const controlResponseStatuses = [
  "unanswered",
  "yes",
  "partial",
  "no",
  "not_applicable",
] as const;
export type ControlResponseStatus = (typeof controlResponseStatuses)[number];

export const guaranteeClaimStatuses = [
  "filed",
  "assigned",
  "in_remediation",
  "remediated",
  "rejected_ineligible",
] as const;
export type GuaranteeClaimStatus = (typeof guaranteeClaimStatuses)[number];

export const frameworks = ["cmmc_l1", "cmmc_l2"] as const;
export type Framework = (typeof frameworks)[number];

export const evidenceVerdicts = [
  "sufficient",
  "insufficient",
  "unclear",
  "not_relevant",
] as const;
export type EvidenceVerdict = (typeof evidenceVerdicts)[number];

export const conversationKinds = [
  "onboarding",
  "workspace",
  "evidence_review",
] as const;
export type ConversationKind = (typeof conversationKinds)[number];

export const messageRoles = ["user", "assistant", "tool", "system"] as const;
export type MessageRole = (typeof messageRoles)[number];

export const escalationUrgencies = ["routine", "priority", "urgent"] as const;
export type EscalationUrgency = (typeof escalationUrgencies)[number];

export const escalationStatuses = [
  "open",
  "acknowledged",
  "scheduled",
  "resolved",
  "dismissed",
] as const;
export type EscalationStatus = (typeof escalationStatuses)[number];

export const milestoneKinds = [
  "affirmation_due",
  "q1_evidence_refresh",
  "q2_check",
  "q3_prime_readiness",
  "q4_prep",
  "onboarding",
  "custom",
] as const;
export type MilestoneKind = (typeof milestoneKinds)[number];

export const remediationStatuses = [
  "open",
  "in_progress",
  "closed",
  "abandoned",
] as const;
export type RemediationStatus = (typeof remediationStatuses)[number];

export const carryForwardStatuses = [
  "pending_review",
  "kept",
  "needs_replacement",
  "removed",
] as const;
export type CarryForwardStatus = (typeof carryForwardStatuses)[number];

// CMMC L1 v2.13 — per-assessment-objective findings.
// Source: 32 CFR § 170.24 + CMMC Assessment Guide L1 v2.13.
// One NOT_MET fails the parent requirement; N_A is equivalent to MET when
// justified. EE / TD evidence (system security plan or operational plan of
// action with milestones) lets the rollup mark MET despite an open gap.
export const objectiveStatuses = [
  "unanswered",
  "met",
  "not_met",
  "not_applicable",
] as const;
export type ObjectiveStatus = (typeof objectiveStatuses)[number];

export const objectiveExceptionTypes = ["enduring", "temporary"] as const;
export type ObjectiveExceptionType = (typeof objectiveExceptionTypes)[number];

// Per NIST SP 800-171A: Examine, Interview, Test. Captured per objective
// so the artifact pack records HOW the requirement was satisfied (e.g.
// "examine the access control list" vs. "test that disabled accounts
// cannot log in").
export const assessmentMethods = ["examine", "interview", "test"] as const;
export type AssessmentMethod = (typeof assessmentMethods)[number];

// 32 CFR § 170.19(b)(3) scope-inventory categories.
export const scopeKinds = ["people", "technology", "facility", "esp"] as const;
export type ScopeKind = (typeof scopeKinds)[number];

// 32 CFR § 170.19(b)(2)(ii) Specialized Asset categories. Documented but
// NOT assessed against L1 requirements.
export const specializedAssetTypes = [
  "iot",
  "iiot",
  "ot",
  "gfe",
  "restricted",
  "test_equipment",
] as const;
export type SpecializedAssetType = (typeof specializedAssetTypes)[number];

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return databaseUrl;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export async function initDb(): Promise<void> {
  return ensureDbReady();
}

async function runInitDdl() {
  validateEnvOnce();
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      company TEXT,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Monday Bid Digest — weekly SAM.gov opportunities email list for the
  // top-of-funnel AEO/SEO blog audience. Double-opt-in: rows are created
  // unconfirmed; confirmed_at is set when the recipient clicks the link.
  await sql`
    CREATE TABLE IF NOT EXISTS bid_digest_subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      naics_codes TEXT[] NOT NULL DEFAULT '{}',
      source TEXT,
      confirm_token TEXT NOT NULL UNIQUE,
      unsubscribe_token TEXT NOT NULL UNIQUE,
      confirmed_at TIMESTAMPTZ,
      unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT,
      sprint_stage TEXT NOT NULL DEFAULT 'lead-intake',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        sprint_stage IN (
          'lead-intake',
          'sam-registration',
          'ssp-draft',
          'controls-implementation',
          'evidence-review',
          'bid-ready',
          'retainer'
        )
      )
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      entity_type TEXT,
      cage_code TEXT,
      sam_uei TEXT,
      naics_codes TEXT[] NOT NULL DEFAULT '{}',
      tier TEXT NOT NULL DEFAULT 'solo'
        CHECK (tier IN ('solo','bootcamp','command')),
      scoped_systems TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Migration path: older deployments had clerk_org_id and a memberships table.
  // Backfill owner_user_id from the 'solo:<userId>' convention, then remove the
  // legacy column and table. Guarded so a fresh database (no clerk_org_id
  // column) doesn't error at parse time on the UPDATE's WHERE clause.
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations'
          AND column_name = 'clerk_org_id'
      ) THEN
        UPDATE organizations
        SET owner_user_id = SUBSTRING(clerk_org_id FROM 6)
        WHERE owner_user_id IS NULL
          AND clerk_org_id IS NOT NULL
          AND clerk_org_id LIKE 'solo:%';
        ALTER TABLE organizations DROP COLUMN clerk_org_id;
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organizations_owner_user_id_key'
      ) THEN
        ALTER TABLE organizations
          ADD CONSTRAINT organizations_owner_user_id_key UNIQUE (owner_user_id);
      END IF;
    END $$
  `;
  await sql`ALTER TABLE organizations ALTER COLUMN owner_user_id SET NOT NULL`;
  await sql`DROP TABLE IF EXISTS memberships`;

  // ── MSP multi-tenancy ────────────────────────────────────────────────
  // Re-introduce clerk_org_id, this time as the canonical tenancy key for
  // any organization that originated from a Clerk Organization (i.e. a
  // business an MSP is managing). NULL = legacy "personal" org keyed by
  // owner_user_id only. The two access patterns are kept distinct via
  // partial unique indexes so a single user can simultaneously own one
  // personal org AND many Clerk-org-linked managed businesses.
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS clerk_org_id TEXT
  `;
  // Drop the old global UNIQUE on owner_user_id — it blocks an MSP user
  // from owning more than one organization. Replace with a partial index
  // that only enforces uniqueness for the user's *personal* (non-Clerk)
  // org row, so legacy solo behaviour is preserved.
  await sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organizations_owner_user_id_key'
      ) THEN
        ALTER TABLE organizations
          DROP CONSTRAINT organizations_owner_user_id_key;
      END IF;
    END $$
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS organizations_personal_owner_uidx
      ON organizations (owner_user_id)
      WHERE clerk_org_id IS NULL
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS organizations_clerk_org_uidx
      ON organizations (clerk_org_id)
      WHERE clerk_org_id IS NOT NULL
  `;

  // One-shot welcome email dedupe. Set when sendWelcomeEmail succeeds; left
  // NULL on failure so the next sign-in retries.
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ
  `;

  // 14-day trial drip dedupe. One row per (organization_id, step_key) the
  // first time that step's email is successfully sent. Lookup is the only
  // gate against re-sends, so the unique index is mandatory. `step_key`
  // values are defined in src/lib/email/trial-drip.ts (e.g. 'day_3_wins').
  await sql`
    CREATE TABLE IF NOT EXISTS trial_drip_sends (
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      message_id TEXT,
      PRIMARY KEY (organization_id, step_key)
    )
  `;
  // Org-level kill-switch. Set TRUE to stop all future drip sends for this
  // org (e.g. customer unsubscribed, complained, or upgraded to paid before
  // the drip completed and we don't want to keep nudging them).
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS trial_drip_disabled BOOLEAN NOT NULL DEFAULT FALSE
  `;

  // SAM.gov radar weekly email opt-out. Default TRUE so every org is opted in
  // by default (we promise this on the landing page); the bid-ready profile
  // page exposes a toggle to flip to FALSE.
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS sam_radar_emails_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `;

  // Tier 2 zero-trust: per-tenant Data Encryption Key (DEK), wrapped under
  // the platform Key Encryption Key (KEK). NULL = not yet provisioned (lazy
  // create on first encrypt). `dek_shredded_at` set non-null means the
  // tenant has been crypto-shredded — the wrapped DEK is destroyed and any
  // remaining v2 ciphertext for this org is permanently unreadable, no
  // matter who later compromises the KEK or the database. See
  // src/lib/security/field-encryption.ts.
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS wrapped_dek BYTEA
  `;
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS dek_shredded_at TIMESTAMPTZ
  `;

  // FCI Boundary Scope Profile (CMMC L1). Typed JSON object that drives the
  // boundary diagram, SSP § 1.2 narrative, and validation gates. Replaces the
  // freeform `scoped_systems` paragraph for new clients; old paragraph is
  // kept for backward compatibility and migrated lazily on next intake.
  // See src/lib/cmmc/scope.ts and plans/fci-boundary-scope.md.
  await sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS scope_profile JSONB
  `;

  // Client-side intake portal — magic-link invitations an MSP sends to a
  // client so they can complete onboarding (and later boundary capture) on
  // their own time. The token is the only auth; expires after 14 days. Each
  // invite is scoped to ONE organization. completed_sections tracks which
  // chunks the client has finished so the MSP gets notified.
  await sql`
    CREATE TABLE IF NOT EXISTS intake_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by_user_id TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_name TEXT,
      token TEXT NOT NULL UNIQUE,
      sections TEXT[] NOT NULL DEFAULT ARRAY['profile','boundary'],
      completed_sections TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      last_seen_at TIMESTAMPTZ,
      notified_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_invitations_org
    ON intake_invitations(organization_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_intake_invitations_token
    ON intake_invitations(token)
    WHERE revoked_at IS NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS officer_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      officer_user_id TEXT NOT NULL,
      assignment_type TEXT NOT NULL
        CHECK (assignment_type IN ('bootcamp','command','guarantee')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      cycle_label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress','officer_review','customer_review','attested','archived')),
      submitted_at TIMESTAMPTZ,
      affirmed_at TIMESTAMPTZ,
      affirmed_by_name TEXT,
      affirmed_by_title TEXT,
      sprs_score INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Phase 0 additions: framework + fiscal_year on assessments.
  // FY runs Oct 1 → Sep 30 (US fed). FY = calendar_year + 1 if month >= 10 else calendar_year.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS framework TEXT NOT NULL DEFAULT 'cmmc_l1'
        CHECK (framework IN ('cmmc_l1','cmmc_l2'))
  `;
  await sql`ALTER TABLE assessments ADD COLUMN IF NOT EXISTS fiscal_year INT`;
  await sql`
    UPDATE assessments
    SET fiscal_year = CASE
      WHEN EXTRACT(MONTH FROM created_at) >= 10
        THEN EXTRACT(YEAR FROM created_at)::int + 1
      ELSE EXTRACT(YEAR FROM created_at)::int
    END
    WHERE fiscal_year IS NULL
  `;

  // CMMC L1 affirmation is binary — implements all 15 FAR safeguarding
  // requirements yes/no. The legacy column name is `implements_all_17`
  // (kept for schema compat — refers to the 17 CMMC practice IDs that map
  // to the 15 FAR 52.204-21(b)(1) requirements). The legacy
  // sprs_score column was being set to 110 (an L2/DFARS-7012 NIST 800-171
  // scoring artifact that does NOT apply to L1). We keep the column for
  // forward-compat with L2 cycles but track the L1 outcome explicitly.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS implements_all_17 BOOLEAN
  `;
  // Backfill: any prior attested L1 with sprs_score = 110 was a binary "yes."
  await sql`
    UPDATE assessments
    SET implements_all_17 = TRUE
    WHERE framework = 'cmmc_l1'
      AND status = 'attested'
      AND sprs_score = 110
      AND implements_all_17 IS NULL
  `;
  // Carry-forward link from a new cycle to the prior cycle whose answers we
  // imported. Lets the rollover review UI know what to surface.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS carried_forward_from UUID REFERENCES assessments(id) ON DELETE SET NULL
  `;

  // SPRS filing record — the user's self-reported moment of truth. After
  // they sign their affirmation we walk them to https://piee.eb.mil → SPRS
  // → Cyber Reports → CMMC Assessments tab → "Add New Level 1 CMMC
  // Self-Assessment" (SPRS CMMC Quick Entry Guide v4.0, DEC 2024). SPRS
  // posts the record with a CMMC Status Date and the visible status type
  // "Final Level 1 Self-Assessment". It does NOT issue a separate
  // confirmation number — the CMMC Status Date IS the federal artifact.
  // The user pastes that posting date back into the platform. This is the
  // milestone that flips the org to "bid-eligible" and triggers the
  // confirmation email + Statement of Compliance artifact. Never auto-set
  // — must come from the user explicitly.
  //
  // Schema history: `sprs_confirmation_number` (TEXT) is retained as a
  // legacy free-form internal reference field. New filings populate
  // `sprs_status_date` (DATE) as the authoritative federal-record value;
  // confirmation_number becomes optional and is treated as an internal
  // tracking string only.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS sprs_filed_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS sprs_confirmation_number TEXT
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS sprs_status_date DATE
  `;

  // CMMC L1 v2.13 distinguishes the *self-assessment completion date*
  // (the day the user finished walking the 15 requirements / 59
  // objectives) from the *affirmation date* (the day the Senior
  // Official signed the affirmation memo). SPRS's "Add New Level 1
  // CMMC Self-Assessment" form asks for the assessment date as its
  // own field — it is not always the same as the affirmation date,
  // especially when the AO has to be tracked down after the work is
  // done. We capture it explicitly. Defaults to the affirmation
  // timestamp at sign time when the user doesn't override, so legacy
  // single-day workflows still produce a value.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS self_assessment_completed_at TIMESTAMPTZ
  `;
  await sql`
    UPDATE assessments
    SET self_assessment_completed_at = affirmed_at
    WHERE affirmed_at IS NOT NULL
      AND self_assessment_completed_at IS NULL
  `;

  // CMMC Scoping Guide L1 v2.13 § 170.19 p. 4: "A new assessment is required
  // if there are significant architectural or boundary changes to the
  // previous CMMC Assessment Scope. Examples include, but are not limited
  // to, expansions of networks or mergers and acquisitions." At annual
  // re-affirmation time we surface a 4-question material-change interview
  // BEFORE allowing the user to walk through a carried-forward assessment.
  // If any answer is "yes" we wipe carry-forward and force a fresh walk;
  // if all "no" we record the reviewed_at timestamp and let the user
  // re-affirm operational continuity. material_change_details holds the
  // raw answers + free-text rationale for audit.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS material_change_reviewed_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS material_change_required_reassessment BOOLEAN
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS material_change_details JSONB
  `;

  // Custodia Verified — public-facing identifiers. Derived deterministically
  // from (org, assessment, filing timestamp) by `src/lib/trust-page.ts`.
  // The `sprs_attestation_hash` is the full HMAC kept as an internal join
  // key; the `custodia_verification_id` is the human-friendly CUST-V-XXXXXX
  // shown on badges and emails. No federal-record detail (CMMC Status Date
  // or internal reference) is ever mixed into the HMAC seed — these IDs
  // reveal nothing private.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS sprs_attestation_hash TEXT
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS custodia_verification_id TEXT
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assessments_custodia_verification_id
      ON assessments (custodia_verification_id)
      WHERE custodia_verification_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS control_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unanswered'
        CHECK (status IN ('unanswered','yes','partial','no','not_applicable')),
      narrative TEXT,
      officer_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
      officer_reviewed_at TIMESTAMPTZ,
      officer_reviewer_user_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (assessment_id, control_id)
    )
  `;

  // Carry-forward state for responses imported from the prior cycle. Default
  // 'kept' means the response originated in this cycle and needs no review.
  // Rollover sets new copies to 'pending_review' so the user is forced to
  // re-confirm currency before signing.
  await sql`
    ALTER TABLE control_responses
      ADD COLUMN IF NOT EXISTS carry_forward_status TEXT NOT NULL DEFAULT 'kept'
        CHECK (carry_forward_status IN ('pending_review','kept','needs_replacement','removed'))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS evidence_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      mime_type TEXT,
      size_bytes BIGINT,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      uploaded_by_user_id TEXT NOT NULL,
      ai_suggested_controls TEXT[] NOT NULL DEFAULT '{}',
      ai_ocr_text TEXT,
      supersedes_artifact_id UUID REFERENCES evidence_artifacts(id)
    )
  `;

  // Phase 0: AI vision review columns on evidence. Every upload gets a verdict
  // before it can count toward attestation. See feedback_evidence_gating.md.
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS ai_review_verdict TEXT
        CHECK (ai_review_verdict IN ('sufficient','insufficient','unclear','not_relevant'))
  `;
  await sql`ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS ai_review_summary TEXT`;
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS ai_review_mapped_controls TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS ai_review_model TEXT`;

  // Tier 1 → Tier 2 backfill marker. 'v1' = blob bytes still encrypted
  // under the raw KEK; 'v2' = re-wrapped under the per-tenant DEK. The
  // /api/cron/encryption-backfill job migrates rows forward and stamps
  // this column so subsequent runs skip them.
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS encryption_version TEXT
        DEFAULT 'v1'
        CHECK (encryption_version IN ('v1', 'v2'))
  `;

  // Carry-forward bookkeeping for artifacts imported from a prior cycle.
  // prior_artifact_id points back to the source row; carry_forward_status
  // begins as 'pending_review' and the user must explicitly keep/replace/remove
  // before the artifact counts toward the new cycle's evidence gate.
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS prior_artifact_id UUID REFERENCES evidence_artifacts(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS carry_forward_status TEXT NOT NULL DEFAULT 'kept'
        CHECK (carry_forward_status IN ('pending_review','kept','needs_replacement','removed'))
  `;

  // CMMC AG L1 v2.13 p. 7 + § 170.24: evidence "must be in final form."
  // Charlie-drafted markdown / DOCX policies fail the AI vision gate
  // (verdict 'unclear' + model 'none') by design. The "Mark as final"
  // override lets a user formally adopt a draft as a policy of record:
  // they enter the adopter name + adoption date, the artifact is then
  // accepted as MET regardless of the vision verdict, and the SSP renders
  // a "Final policy adopted YYYY-MM-DD by <name>" disclosure. This is the
  // documented escape hatch from the auto-block rule (plan #17 + #23).
  await sql`ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS is_final_policy BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS final_adopted_at TIMESTAMPTZ`;
  await sql`ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS final_adopted_by TEXT`;

  // CMMC AG L1 v2.13 pp. 5–7 defines three assessment methods. Tagging
  // each artifact at upload time makes the SSP substantially more
  // defensible when a prime asks "show me the test evidence for X."
  // Optional — defaults to NULL when the user hasn't picked one yet.
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS assessment_method TEXT
        CHECK (assessment_method IN ('examine','interview','test'))
  `;

  // Per-objective evidence tagging. CMMC L1 evaluates each practice against
  // NIST 800-171A assessment objectives [a]/[b]/[c]/...; one artifact often
  // satisfies multiple objectives, and one artifact can be reused across
  // practices (e.g. the same authorized-users roster covers AC.L1-3.1.1
  // AND IA.L1-3.5.1). The legacy schema only had a single `control_id`
  // column on evidence_artifacts, so we keep that for backwards compat and
  // overlay this join table for the new model.
  //
  // Each row says: artifact X contributes to (assessment Y, practice P)
  // with this set of objective letters. `objectives` is the official
  // [a]/[b]/[c]/... letters from NIST 800-171A; an empty array means the
  // artifact is tagged to the practice as a whole (legacy behaviour).
  await sql`
    CREATE TABLE IF NOT EXISTS evidence_artifact_practices (
      artifact_id UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      objectives TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by_user_id TEXT,
      PRIMARY KEY (artifact_id, assessment_id, control_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_eap_assessment_control
      ON evidence_artifact_practices (assessment_id, control_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_eap_artifact
      ON evidence_artifact_practices (artifact_id)
  `;

  // Backfill: for every existing artifact, mirror its (assessment_id,
  // control_id) into the join table so the new query path returns the
  // same rows as the legacy path. Idempotent — `ON CONFLICT DO NOTHING`
  // handles repeat boots and any rows the app code wrote directly.
  await sql`
    INSERT INTO evidence_artifact_practices
      (artifact_id, assessment_id, control_id, objectives, created_by_user_id)
    SELECT id, assessment_id, control_id, '{}'::text[], uploaded_by_user_id
    FROM evidence_artifacts
    ON CONFLICT (artifact_id, assessment_id, control_id) DO NOTHING
  `;

  // CMMC L1 remediation plans (POA&M-style visibility, not a sign-bypass).
  // L1 affirmation is binary — you can't legally sign while practices are
  // Not met / Partial. Plans give the user a tracked roadmap to closure and
  // give primes a clean answer when they ask "what's your gap-closure plan?"
  // Signing remains gated on every practice being Met or N/A.
  await sql`
    CREATE TABLE IF NOT EXISTS remediation_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      gap_summary TEXT NOT NULL,
      planned_actions TEXT NOT NULL,
      target_close_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','in_progress','closed','abandoned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      UNIQUE (assessment_id, control_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_remediation_plans_assessment
      ON remediation_plans (assessment_id, status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
      control_id TEXT,
      generation_type TEXT NOT NULL,
      input_summary TEXT,
      output_text TEXT,
      model TEXT NOT NULL,
      prompt_cache_hit BOOLEAN,
      input_tokens INT,
      output_tokens INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by_user_id TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS officer_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      officer_user_id TEXT NOT NULL,
      impersonated_user_id TEXT,
      action_type TEXT NOT NULL,
      target_table TEXT,
      target_id UUID,
      diff_summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Phase 0: per-org structured business understanding maintained by the AI.
  // One row per org; `data` is a JSONB snapshot the AI rewrites over time.
  await sql`
    CREATE TABLE IF NOT EXISTS business_profile (
      organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      completeness_score INT NOT NULL DEFAULT 0,
      last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_updated_by TEXT NOT NULL DEFAULT 'user'
        CHECK (last_updated_by IN ('user','ai'))
    )
  `;

  // Phase 0: persistent AI officer conversations.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'workspace'
        CHECK (kind IN ('onboarding','workspace','evidence_review')),
      title TEXT,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_kind
      ON ai_conversations (organization_id, kind, archived)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
      content JSONB NOT NULL,
      tool_use_id TEXT,
      input_tokens INT,
      output_tokens INT,
      cache_read_tokens INT,
      cache_creation_tokens INT,
      model TEXT,
      stop_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conv
      ON ai_messages (conversation_id, created_at)
  `;

  // Per-org compressed long-term memory of officer conversations. Cheap
  // alternative to a vector store: rolling text summary + extracted JSON
  // facts, rebuilt by a small LLM call when stale. Lets the workspace
  // officer remember everything from onboarding (and prior workspace
  // sessions) without paying token cost on the full transcript.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_memory (
      organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      summary TEXT NOT NULL DEFAULT '',
      key_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
      messages_summarized INT NOT NULL DEFAULT 0,
      last_built_at TIMESTAMPTZ,
      last_built_model TEXT
    )
  `;

  // Charlie tool-call audit log. Every AI tool invocation is recorded
  // here with SHA-256 hashes of input and output, the tool name, status,
  // and the trusted tenant/user/conversation context. Payload contents
  // live encrypted on `ai_messages.content`; this table is the
  // tamper-evident cross-reference. Hashed instead of raw so we don't
  // double the leak surface and so we can group/aggregate without ever
  // decrypting (e.g. "how many duplicate add_scope_item calls today").
  await sql`
    CREATE TABLE IF NOT EXISTS ai_tool_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT,
      conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
      message_id UUID REFERENCES ai_messages(id) ON DELETE SET NULL,
      tool_name TEXT NOT NULL,
      input_sha256 TEXT NOT NULL,
      output_sha256 TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ok','error','denied','rate_limited')),
      duration_ms INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_org_created
      ON ai_tool_audit (organization_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_tool
      ON ai_tool_audit (tool_name, created_at DESC)
  `;

  // Phase 0: fiscal-calendar milestones keeping orgs compliant year-over-year.
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_milestones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
      fiscal_year INT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE NOT NULL,
      completed_at TIMESTAMPTZ,
      snoozed_until DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_milestones_org_due
      ON compliance_milestones (organization_id, due_date)
  `;
  // Debounce column for the reminder cron — we only post to the officer rail
  // at most once every few days per milestone, no matter how often the cron runs.
  await sql`
    ALTER TABLE compliance_milestones
      ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ
  `;

  // Phase 2: officer-handoff requests surfaced by the AI's escalate_to_officer
  // tool. Drives the upsell to Bootcamp / Command services.
  await sql`
    CREATE TABLE IF NOT EXISTS officer_escalations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
      topic TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'routine'
        CHECK (urgency IN ('routine','priority','urgent')),
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','acknowledged','scheduled','resolved','dismissed')),
      assigned_officer_user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_escalations_org_status
      ON officer_escalations (organization_id, status)
  `;

  // Two-way ticket thread under each officer_escalations row. Inbound email
  // replies from support@custodia.dev land here as sender_type='officer';
  // user replies from the platform land here as sender_type='user'. The AI's
  // initial summary is inserted as sender_type='system' when the row is
  // created. email_message_id holds the RFC 5322 Message-ID for thread
  // stitching across providers.
  await sql`
    CREATE TABLE IF NOT EXISTS escalation_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      escalation_id UUID NOT NULL REFERENCES officer_escalations(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL
        CHECK (sender_type IN ('user','officer','system')),
      sender_user_id TEXT,
      sender_email TEXT,
      body TEXT NOT NULL,
      email_message_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_by_user_at TIMESTAMPTZ,
      read_by_officer_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_escalation_messages_escalation
      ON escalation_messages (escalation_id, created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_escalation_messages_email_msg
      ON escalation_messages (email_message_id)
      WHERE email_message_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guarantee_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      prime_name TEXT,
      rejection_reason TEXT,
      rejection_document_url TEXT,
      status TEXT NOT NULL DEFAULT 'filed'
        CHECK (status IN ('filed','assigned','in_remediation','remediated','rejected_ineligible')),
      assigned_officer_user_id TEXT,
      filed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      remediation_notes TEXT
    )
  `;

  // Evidence freshness — every artifact has a valid-until date and a class
  // (cert / scan / screenshot / training / policy / misc) that determines the
  // default lifetime. Cron `/api/cron/evidence-freshness` emails the org owner
  // when artifacts approach or pass their valid_until. Default lifetimes are
  // applied at INSERT time by INSERT...SELECT in lib/freshness.ts; existing
  // rows are backfilled here once.
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS valid_until DATE
  `;
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS freshness_class TEXT
  `;
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS staleness_notified_at TIMESTAMPTZ
  `;
  // Backfill: any pre-existing artifact gets captured_at + 365d as a safe
  // default. The freshness lib will refine class on next user interaction.
  await sql`
    UPDATE evidence_artifacts
    SET valid_until = (captured_at + INTERVAL '365 days')::date
    WHERE valid_until IS NULL
  `;
  await sql`
    UPDATE evidence_artifacts
    SET freshness_class = 'misc'
    WHERE freshness_class IS NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_evidence_valid_until
      ON evidence_artifacts (valid_until)
  `;

  // SAM.gov radar — per-org cache of opportunities matched to NAICS / set-aside
  // filters. Cron `/api/cron/sam-radar` populates this weekly and emails a
  // digest. The `dismissed_at` and `viewed_at` columns let the inbox UI hide
  // ones the user has already triaged.
  await sql`
    CREATE TABLE IF NOT EXISTS sam_opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      notice_id TEXT NOT NULL,
      title TEXT NOT NULL,
      department TEXT,
      sub_tier TEXT,
      office TEXT,
      type TEXT,
      naics_code TEXT,
      set_aside TEXT,
      response_deadline TIMESTAMPTZ,
      posted_date TIMESTAMPTZ,
      sam_url TEXT,
      description TEXT,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      matched_on JSONB NOT NULL DEFAULT '{}'::jsonb,
      seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      viewed_at TIMESTAMPTZ,
      dismissed_at TIMESTAMPTZ,
      digested_at TIMESTAMPTZ,
      UNIQUE (organization_id, notice_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sam_opps_org_seen
      ON sam_opportunities (organization_id, seen_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sam_opps_org_open
      ON sam_opportunities (organization_id)
      WHERE dismissed_at IS NULL
  `;

  // Daily Discover cache — keyed on (naics_code, fetched_for_date) so every
  // org watching the same NAICS shares the same upstream pull. The /opportunities
  // bonus page reads from here on every render and only triggers a SAM.gov
  // call when today's row is missing for one of the user's codes. This lets
  // a 1k-user platform run on the public 1,000/day api.data.gov key.
  //   payload: array of CachedOpportunityCard for that NAICS for that day,
  //            already filtered to CMMC-L1-friendly notices, sorted by
  //            posted_date desc.
  await sql`
    CREATE TABLE IF NOT EXISTS sam_naics_daily (
      naics_code        TEXT NOT NULL,
      fetched_for_date  DATE NOT NULL,
      payload           JSONB NOT NULL,
      fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (naics_code, fetched_for_date)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sam_naics_daily_date
      ON sam_naics_daily (fetched_for_date DESC)
  `;

  // -------------------------------------------------------------------------
  // Security / CMMC L1 platform controls
  // -------------------------------------------------------------------------

  // HMAC-signed attestations. Canonical JSON of the attestation payload is
  // stored alongside its SHA-256 hash and HMAC signature so the legal artifact
  // can be re-verified at any time. Required for evidentiary integrity.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS attestation_canonical TEXT
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS attestation_payload_sha256 TEXT
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS attestation_signature TEXT
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS attestation_signature_key_version SMALLINT
  `;

  // Append-only security audit log. Hooked from sign-off, evidence ops,
  // unauthorized cron hits, org-field updates. Required for CMMC L1 AC.L1
  // and SI.L1 evidentiary coverage.
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      user_id TEXT,
      organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
      resource_type TEXT,
      resource_id TEXT,
      ip TEXT,
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
      ON audit_log (organization_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
      ON audit_log (action, created_at DESC)
  `;

  // 32 CFR § 170.22(d) requires reaffirmation any time a material change
  // affects the system or scope. This is a structured filing log — one row
  // per declared change — distinct from the once-per-annual-cycle
  // `assessments.material_change_reviewed_at` snapshot (which records that
  // the user completed the annual interview, not that they filed a change).
  // The Charlie `file_material_change` tool writes here; the affirmation
  // bar surfaces unresolved entries.
  await sql`
    CREATE TABLE IF NOT EXISTS material_changes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      filed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      filed_by_user_id TEXT NOT NULL,
      requires_reassessment BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS material_changes_org_assessment_filed_idx
      ON material_changes (organization_id, assessment_id, filed_at DESC)
  `;

  // ── Tier 3: SSP narrative copilot ──────────────────────────────────────
  // Two-table cohort that lets Charlie ghostwrite the per-control SSP
  // narratives from interview-driven context (org profile + scope + evidence
  // filenames + control text) and produce a critique-history audit trail
  // assessors can review alongside the SSP itself.
  //
  // narrative_interview_sessions: ephemeral, per (assessment, control, user)
  // working buffer. turns[] holds the back-and-forth and final draft so the
  // user can resume mid-interview. Auto-cleaned at 30 days.
  //
  // narrative_critique_history: append-only "what was wrong with this SSP
  // section at point in time T". narrative_hash lets the UI tell the user
  // "you haven't changed this since the last critique — here's what's still
  // weak" without re-spending the LLM call.
  await sql`
    CREATE TABLE IF NOT EXISTS narrative_interview_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      turns JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','drafted','abandoned')),
      draft_narrative TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS narrative_interview_sessions_active_idx
      ON narrative_interview_sessions
        (organization_id, assessment_id, control_id, user_id)
      WHERE status = 'active'
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS narrative_critique_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      narrative_hash TEXT NOT NULL,
      ready BOOLEAN NOT NULL,
      weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
      critiqued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      critiqued_by_user_id TEXT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS narrative_critique_history_lookup_idx
      ON narrative_critique_history
        (organization_id, assessment_id, control_id, critiqued_at DESC)
  `;

  // Postgres-backed fixed-window rate limiter (defense-in-depth against
  // LLM-cost abuse and waitlist spam). See src/lib/security/rate-limit.ts.
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY,
      count INT NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Per-org cache of the live SAM.gov "first 4 matches" feed used by the
  // /opportunities page. Cuts the per-pageview SAM.gov + Anthropic Haiku
  // spend down to ~zero (one refresh per stale-window or NAICS change),
  // and lets the page keep rendering real listings even when SAM.gov is
  // briefly unreachable.
  //   - payload_hash: stable hash of the (noticeId-sorted) result set so
  //                   we can detect "result actually changed" without
  //                   diffing JSON blobs.
  //   - payload    : array of cached opportunity card data (already
  //                   AI-summarized) ready to spread into the page.
  //   - fetched_at : last successful refresh; the read path uses a TTL.
  await sql`
    CREATE TABLE IF NOT EXISTS sam_live_cache (
      organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      naics_key       TEXT NOT NULL,
      payload_hash    TEXT NOT NULL,
      payload         JSONB NOT NULL,
      fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // -------------------------------------------------------------------------
  // CMMC L1 pivot — connectors, scheduler, monitors, manual evidence,
  // trust pages, and free SPRS quiz lead-gen.
  // -------------------------------------------------------------------------

  // OAuth-issued connector tokens for evidence sources (Microsoft 365,
  // Google Workspace, future: Okta, AWS, on-prem AD). Encrypted at rest
  // with the same envelope as attestations (src/lib/security/crypto.ts).
  // One row per (org, provider).
  await sql`
    CREATE TABLE IF NOT EXISTS connector_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      account_label TEXT,
      encrypted_access_token TEXT NOT NULL,
      encrypted_refresh_token TEXT,
      scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      expires_at TIMESTAMPTZ,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      UNIQUE (organization_id, provider)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_connector_tokens_org
      ON connector_tokens (organization_id)
      WHERE revoked_at IS NULL
  `;

  // Connector pull provenance. Every fetch from a connected provider
  // (M365 Graph, Google Workspace) writes a row here BEFORE the resulting
  // bytes land in evidence_artifacts. This is the audit trail an assessor
  // looks at to answer "where did this user roster come from and when?".
  // raw_hash is sha256 of the canonical payload bytes — the same bytes
  // we wrote to blob storage. row_count is the artifact count produced.
  await sql`
    CREATE TABLE IF NOT EXISTS connector_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','success','partial','failed')),
      row_count INT,
      error TEXT,
      raw_hash TEXT,
      triggered_by TEXT NOT NULL DEFAULT 'scheduler'
        CHECK (triggered_by IN ('scheduler','manual','webhook'))
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_connector_runs_org_started
      ON connector_runs (organization_id, started_at DESC)
  `;

  // Connector evidence provenance on evidence_artifacts. These columns
  // mark an artifact as "pulled from a system of record" rather than
  // "uploaded by a human". An assessor can recompute data_hash from the
  // bytes and compare against this column to prove the artifact has not
  // been tampered with since the connector wrote it.
  await sql`
    ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS source_provider TEXT
  `;
  await sql`
    ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS source_kind TEXT
  `;
  await sql`
    ALTER TABLE evidence_artifacts
      ADD COLUMN IF NOT EXISTS source_run_id UUID REFERENCES connector_runs(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS data_hash TEXT
  `;
  await sql`
    ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_source
      ON evidence_artifacts (assessment_id, source_provider, source_kind)
      WHERE source_provider IS NOT NULL
  `;

  // Per-customer task scheduler. Pulls due tasks every ~5min via
  // /api/cron/scheduler. Keeps the task graph in Postgres so we can
  // reschedule, retry, and audit without touching code.
  await sql`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      next_run_at TIMESTAMPTZ NOT NULL,
      last_run_at TIMESTAMPTZ,
      last_status TEXT,
      last_error TEXT,
      run_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
      ON scheduled_tasks (next_run_at)
      WHERE last_status IS DISTINCT FROM 'cancelled'
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_org_kind
      ON scheduled_tasks (organization_id, kind)
  `;

  // Continuous-monitoring alerts. Charlie raises these when an automated
  // check (MFA disabled on a user, screen-lock policy turned off, etc.)
  // detects a regression. Surface in the dashboard banner + Pulse email.
  await sql`
    CREATE TABLE IF NOT EXISTS monitor_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      control_id TEXT,
      message TEXT NOT NULL,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_monitor_alerts_org_open
      ON monitor_alerts (organization_id, opened_at DESC)
      WHERE resolved_at IS NULL
  `;

  // Weekly Compliance Pulse digest log. One row per (org, week_of). The
  // status is the green/yellow/red rollup driving the email subject line.
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_pulses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      week_of DATE NOT NULL,
      status TEXT NOT NULL,
      summary JSONB NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (organization_id, week_of)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_compliance_pulses_org_week
      ON compliance_pulses (organization_id, week_of DESC)
  `;

  // Manual evidence uploads — when a customer can't or doesn't want to
  // wire a connector, they upload spreadsheets / PDFs / screenshots tied
  // to a control. Distinct from `evidence_artifacts` (which is the per-
  // assessment evidence pipeline) so that orgs can capture standing
  // evidence between assessments.
  await sql`
    CREATE TABLE IF NOT EXISTS manual_evidence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      template_slug TEXT,
      blob_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_kind TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      uploaded_by TEXT,
      notes TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_manual_evidence_org_control
      ON manual_evidence (organization_id, control_id, captured_at DESC)
  `;

  // Public, opt-in trust pages. Render at /trust/<slug> with ISR. Exposes
  // attestation status, last refresh date, and a generic FCI-handling
  // posture statement — never raw evidence.
  await sql`
    CREATE TABLE IF NOT EXISTS trust_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      headline TEXT,
      summary TEXT,
      contact_email TEXT,
      fields JSONB NOT NULL DEFAULT '{}'::jsonb,
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_trust_pages_public
      ON trust_pages (slug)
      WHERE is_public = TRUE
  `;

  // Custodia Verified extensions: public verification identifiers, owner
  // display toggles, and the customer-curated about blurb. All ALTERs are
  // idempotent so repeat boots of this init function are safe.
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS verification_slug TEXT
  `;
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS custodia_verification_id TEXT
  `;
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS show_continuous_monitoring BOOLEAN NOT NULL DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS show_connectors BOOLEAN NOT NULL DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS show_sprs_link BOOLEAN NOT NULL DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS show_set_asides BOOLEAN NOT NULL DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE trust_pages
      ADD COLUMN IF NOT EXISTS custom_about TEXT
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_pages_verification_slug
      ON trust_pages (verification_slug)
      WHERE verification_slug IS NOT NULL
  `;

  // trust_status — denormalized, recomputed snapshot of the org's compliance
  // posture. Single source of truth for the public health pill, badge color,
  // and `/api/verify/<slug>` JSON. Recomputed by recomputeTrustStatus()
  // whenever connectors sync, evidence changes, drift opens/resolves, or the
  // hourly safety-net cron fires. Reads on the public path never recompute —
  // they only SELECT from this table for predictable latency under traffic.
  await sql`
    CREATE TABLE IF NOT EXISTS trust_status (
      organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      health TEXT NOT NULL DEFAULT 'gray'
        CHECK (health IN ('green','amber','red','gray')),
      health_reason TEXT,
      practices_met INT NOT NULL DEFAULT 0,
      practices_total INT NOT NULL DEFAULT 17,
      evidence_count INT NOT NULL DEFAULT 0,
      oldest_evidence_age_days INT,
      newest_evidence_age_days INT,
      m365_connected_at TIMESTAMPTZ,
      m365_last_sync_at TIMESTAMPTZ,
      google_connected_at TIMESTAMPTZ,
      google_last_sync_at TIMESTAMPTZ,
      open_drift_count INT NOT NULL DEFAULT 0,
      drift_detected_at TIMESTAMPTZ,
      drift_resolved_at TIMESTAMPTZ,
      affirmation_filed_at TIMESTAMPTZ,
      next_reaffirm_due TIMESTAMPTZ,
      last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // drift_events — append-only log of detected control drift. Closed by
  // setting resolved_at. Powers the public "Open drift: none/X" line and
  // the amber health state. Sourced from connector polls + freshness cron.
  await sql`
    CREATE TABLE IF NOT EXISTS drift_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      signal TEXT NOT NULL,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      severity TEXT NOT NULL DEFAULT 'warn'
        CHECK (severity IN ('info','warn','critical')),
      detail JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_drift_events_org_open
      ON drift_events (organization_id, detected_at DESC)
      WHERE resolved_at IS NULL
  `;

  // Free public SPRS quiz lead-gen. Captures the quiz answers + computed
  // SPRS score for a non-authenticated visitor, joined to an email so
  // sales / lifecycle can follow up.
  await sql`
    CREATE TABLE IF NOT EXISTS sprs_quiz_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      company_name TEXT,
      naics_codes TEXT[],
      answers JSONB NOT NULL,
      score INT NOT NULL,
      max_score INT NOT NULL,
      gap_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      utm_source TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sprs_quiz_email_created
      ON sprs_quiz_submissions (email, created_at DESC)
  `;

  // Hybrid chat+evidence flow: per-(assessment, control) conversation thread
  // where Charlie acts as a CMMC consultant grounded in NIST 800-171A. Stores
  // the full transcript as a JSONB array so the SSP can include the
  // conversation as auditor-grade context. Distinct from the workspace-wide
  // ai_conversations chat — that one is for general questions; this one is
  // bound to a single practice and is used to grade objective coverage.
  await sql`
    CREATE TABLE IF NOT EXISTS practice_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      objective_verdicts JSONB NOT NULL DEFAULT '{}'::jsonb,
      verdict_updated_at TIMESTAMPTZ,
      locked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (assessment_id, control_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_practice_conversations_assessment
      ON practice_conversations (assessment_id, control_id)
  `;

  // ─────────────────────────────────────────────────────────────────────
  // CMMC L1 v2.13 (Sept 2024) + DFARS final rule (Sept 2025) additions.
  // The previous single-status `control_responses` row continues to work
  // for legacy data; these new tables let the platform record findings at
  // the assessment-objective level (NIST 800-171A [a]…[h]), capture the
  // formal scope inventory required by 32 CFR § 170.19(b)(3), track
  // External Service Provider inheritance, document Specialized Assets,
  // and flag Enduring Exceptions / Temporary Deficiencies.
  // ─────────────────────────────────────────────────────────────────────

  // Per-objective findings. CMMC L1 v2.13 requires MET / NOT_MET / N/A on
  // each NIST 800-171A objective letter; one NOT_MET fails the parent
  // requirement (32 CFR § 170.24). Legacy `control_responses` keeps its
  // requirement-level rollup; this table is the source of truth for the
  // 59-objective view, the EE/TD picker, and the SPRS-ready export.
  //
  // Status values map to 32 CFR § 170.24:
  //   met            — all evidence in place
  //   not_met        — one or more determination statements unsatisfied
  //   not_applicable — objective does not apply (must include a justification)
  //   unanswered     — the user hasn't worked this objective yet
  //
  // exception_type lets the user flag an Enduring Exception or a Temporary
  // Deficiency. Per the Assessment Guide, both can roll up to MET when
  // properly documented (EE in the system security plan, TD in an
  // operational plan of action with milestones).
  await sql`
    CREATE TABLE IF NOT EXISTS control_objective_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      control_id TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      objective_letter TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unanswered'
        CHECK (status IN ('unanswered','met','not_met','not_applicable')),
      narrative TEXT,
      na_justification TEXT,
      exception_type TEXT
        CHECK (exception_type IN ('enduring','temporary')),
      exception_notes TEXT,
      esp_inherited_from UUID,
      method TEXT
        CHECK (method IN ('examine','interview','test')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (assessment_id, control_id, objective_letter)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_obj_resp_requirement
      ON control_objective_responses (assessment_id, requirement_id)
  `;

  // Operational plan of action milestones for Temporary Deficiencies. CMMC
  // Assessment Guide L1 v2.13 §"Assessment Findings" allows TDs to score MET
  // when tracked in an operational plan of action with deficiency reviews,
  // milestones, and progress toward correction. One row per milestone.
  await sql`
    CREATE TABLE IF NOT EXISTS objective_milestones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      objective_response_id UUID NOT NULL
        REFERENCES control_objective_responses(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      target_date DATE NOT NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_obj_milestones_response
      ON objective_milestones (objective_response_id)
  `;

  // Formal scope inventory per 32 CFR § 170.19(b)(3): People, Technology,
  // Facilities, External Service Providers (ESPs) handling FCI. The user
  // walks Charlie through this once and signs the resulting register; it
  // doubles as the "scope diagram" rendered into the artifact pack.
  await sql`
    CREATE TABLE IF NOT EXISTS scope_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL
        CHECK (kind IN ('people','technology','facility','esp')),
      label TEXT NOT NULL,
      role TEXT,
      handles_fci BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      retired_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_scope_inventory_org
      ON scope_inventory (organization_id, kind)
      WHERE retired_at IS NULL
  `;

  // ESP registry. Cloud / Managed Services / Cyber-as-a-Service providers
  // that satisfy CMMC L1 objectives on behalf of the OSA. The ESP entry
  // can be linked from a control_objective_responses row via
  // esp_inherited_from to mark inheritance — i.e. "Microsoft 365 covers
  // IA.L1-b.1.vi[a]". Doc that holds the inheritance evidence is the
  // ESP's CMMC status / SOC report attached to this row.
  await sql`
    CREATE TABLE IF NOT EXISTS esp_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      vendor TEXT,
      services TEXT,
      cmmc_status TEXT,
      attestation_doc_url TEXT,
      contact_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_esp_registry_org
      ON esp_registry (organization_id)
  `;

  // Specialized Assets per 32 CFR § 170.19(b)(2)(ii): IoT, IIoT, OT, GFE,
  // Restricted Information Systems, Test Equipment. These can process FCI
  // but are NOT part of the L1 self-assessment scope (they're documented
  // separately, never assessed against requirements). We capture them here
  // so the artifact pack and the SPRS submission narrative can list them
  // — assessors expect to see this list, even though the items themselves
  // aren't graded.
  await sql`
    CREATE TABLE IF NOT EXISTS specialized_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      asset_type TEXT NOT NULL
        CHECK (asset_type IN ('iot','iiot','ot','gfe','restricted','test_equipment')),
      description TEXT,
      handles_fci BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_specialized_assets_org
      ON specialized_assets (organization_id)
  `;

  // CMMC v2.13 + DFARS 7021/7025 affirmation extras on the assessments row.
  // - cmmc_status: the SPRS-tracked outcome ("Final Level 1 (Self)" when
  //   all 15 requirements roll up to MET).
  // - cmmc_model_version / assessment_guide_version: snapshot of the model
  //   version this assessment was scored against, so any reproducibility
  //   request can replay against the exact same control set.
  // - affirming_official_email: legally-binding contact for the Senior
  //   Official affirmation under 32 CFR § 170.22 + DFARS 252.204-7021.
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS cmmc_status TEXT
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS cmmc_model_version TEXT NOT NULL DEFAULT '2.13'
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS assessment_guide_version TEXT NOT NULL DEFAULT '2.13'
  `;
  await sql`
    ALTER TABLE assessments
      ADD COLUMN IF NOT EXISTS affirming_official_email TEXT
  `;
  // Backfill cmmc_status for legacy attested rows.
  await sql`
    UPDATE assessments
    SET cmmc_status = 'Final Level 1 (Self)'
    WHERE framework = 'cmmc_l1'
      AND status = 'attested'
      AND implements_all_17 = TRUE
      AND cmmc_status IS NULL
  `;

  // ─── Outbound pipeline + multi-channel attribution ──────────────────────
  // The /admin console reads/writes these. Every channel that brings paying
  // customers (cold email, affiliates, content, paid ads, partnerships)
  // plugs into the same 5 tables — only the `referral_sources.code` differs.
  //
  //  prospects             — companies discovered (USAspending awards, etc.)
  //  prospect_contacts     — verified people inside those companies
  //  referral_sources      — every channel/affiliate that sends traffic
  //  attribution_touches   — every visit to a tracked landing URL (cookie + email)
  //  conversions           — trial start + paid card events with credited source

  await sql`
    CREATE TABLE IF NOT EXISTS prospects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      domain TEXT,
      uei TEXT,
      cage_code TEXT,
      naics_code TEXT,
      state TEXT,
      city TEXT,
      employee_count INTEGER,
      total_award_amount BIGINT,
      most_recent_award_at TIMESTAMPTZ,
      data_source TEXT NOT NULL DEFAULT 'usaspending',
      raw_payload JSONB,
      icp_score INTEGER,
      icp_band TEXT CHECK (icp_band IN ('A','B','C','reject')),
      icp_reasons JSONB,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new','reviewing','approved','queued','sending','engaged','converted','rejected','suppressed')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Dedup key uses an expression (COALESCE) so it has to be a unique
  // *index*, not an inline UNIQUE constraint (Postgres rejects
  // expressions in column constraints).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_company_domain
      ON prospects (company_name, COALESCE(domain, ''))
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects (status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospects_band ON prospects (icp_band, icp_score DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospects_domain ON prospects (domain) WHERE domain IS NOT NULL`;

  // AI-review columns — additive so existing prospects keep their
  // rule-based score; the AI columns are populated when the AI agent
  // runs over a candidate.
  await sql`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_score INTEGER`;
  await sql`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_band TEXT`;
  await sql`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_reasoning TEXT`;
  await sql`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospects_ai_band ON prospects (ai_band, ai_score DESC) WHERE ai_band IS NOT NULL`;

  // v1-ghost backfill: demote any approved prospects that never went
  // through the AI reviewer (those came from rule-only v1 and include
  // megaprimes that leaked through the old NAICS-based scorer). One-shot
  // and idempotent — once they're 'reviewing' they won't match again.
  await sql`
    UPDATE prospects
    SET status = 'reviewing', updated_at = NOW()
    WHERE status = 'approved' AND ai_reviewed_at IS NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS prospect_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      title TEXT,
      linkedin_url TEXT,
      hunter_confidence INTEGER,
      verification_status TEXT
        CHECK (verification_status IN ('valid','accept_all','webmail','disposable','invalid','unknown')),
      enrichment_source TEXT NOT NULL DEFAULT 'hunter',
      pushed_to_instantly_at TIMESTAMPTZ,
      instantly_lead_id TEXT,
      bounced BOOLEAN NOT NULL DEFAULT FALSE,
      replied BOOLEAN NOT NULL DEFAULT FALSE,
      unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (email)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect ON prospect_contacts (prospect_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospect_contacts_pushed ON prospect_contacts (pushed_to_instantly_at) WHERE pushed_to_instantly_at IS NULL`;

  // ─── prospect_awards — immutable contract intel for outbound copy ──────
  // One row per DoD contract award the prospect won. Source-of-truth from
  // USAspending. Used to hydrate Instantly custom variables for personalized
  // outreach ("you won the $487K Army TACOM award W56HZV-25-D-0042…").
  //
  // ACCURACY CONTRACT:
  //   • Every column here mirrors a literal field from a USAspending API
  //     response. Nothing is derived, inferred, or AI-generated.
  //   • Rows are INSERT-only on (prospect_id, piid, action_date). On repeat
  //     fetches we update last_seen_at + raw_payload only.
  //   • If a field was null from USAspending, it stays null. We never
  //     guess or fall back. Outbound templating skips personalization
  //     when the cited fields are null.
  await sql`
    CREATE TABLE IF NOT EXISTS prospect_awards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      -- Source-of-truth fields (USAspending API). Read-only after first insert.
      piid TEXT NOT NULL,
      internal_id TEXT,
      award_amount_cents BIGINT NOT NULL,
      action_date DATE,
      period_of_performance_start_date DATE,
      period_of_performance_end_date DATE,
      awarding_agency_name TEXT,
      awarding_sub_agency_name TEXT,
      naics_code TEXT,
      naics_description TEXT,
      contract_award_type TEXT,
      description TEXT,
      place_of_performance_state TEXT,
      place_of_performance_city TEXT,
      -- Provenance
      source TEXT NOT NULL DEFAULT 'usaspending',
      raw_payload JSONB NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (prospect_id, piid)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospect_awards_prospect ON prospect_awards (prospect_id, action_date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prospect_awards_pop_end ON prospect_awards (period_of_performance_end_date) WHERE period_of_performance_end_date IS NOT NULL`;

  // Migration: an earlier definition of this table used a 3-column UNIQUE
  // including action_date. action_date is legitimately null on USAspending
  // purchase-order rows, which breaks that key (NULLs aren't equal in
  // standard UNIQUE). Replace with (prospect_id, piid) — same PIID for
  // the same prospect always represents the same contract.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'prospect_awards_prospect_id_piid_action_date_key'
      ) THEN
        ALTER TABLE prospect_awards
          DROP CONSTRAINT prospect_awards_prospect_id_piid_action_date_key;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'prospect_awards_prospect_id_piid_key'
      ) THEN
        ALTER TABLE prospect_awards
          ADD CONSTRAINT prospect_awards_prospect_id_piid_key
          UNIQUE (prospect_id, piid);
      END IF;
    END$$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS referral_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      channel TEXT NOT NULL
        CHECK (channel IN ('cold_email','affiliate','content','paid_ads','partnership','organic','direct','other')),
      affiliate_email TEXT,
      affiliate_clerk_user_id TEXT,
      payout_model TEXT
        CHECK (payout_model IN ('flat','first_year_pct','lifetime_pct') OR payout_model IS NULL),
      payout_amount_cents INTEGER,
      payout_pct NUMERIC(5,2),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_referral_sources_active ON referral_sources (active) WHERE active = TRUE`;

  // Seed the cold email source so the first campaign has a target. Idempotent.
  await sql`
    INSERT INTO referral_sources (code, label, channel)
    VALUES ('cold_email_v1', 'Cold email — Custodia Compliance Officer (v1)', 'cold_email')
    ON CONFLICT (code) DO NOTHING
  `;
  await sql`
    INSERT INTO referral_sources (code, label, channel)
    VALUES ('organic', 'Organic / direct (no source)', 'organic')
    ON CONFLICT (code) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attribution_touches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_cookie_id TEXT NOT NULL,
      source_code TEXT NOT NULL REFERENCES referral_sources(code) ON UPDATE CASCADE,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      landing_path TEXT NOT NULL,
      referrer TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      email TEXT,
      clerk_user_id TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_attribution_touches_cookie ON attribution_touches (visitor_cookie_id, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attribution_touches_email ON attribution_touches (email) WHERE email IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attribution_touches_user ON attribution_touches (clerk_user_id) WHERE clerk_user_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attribution_touches_source ON attribution_touches (source_code, occurred_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS conversions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kind TEXT NOT NULL
        CHECK (kind IN ('quiz_completed','trial_started','card_added','paid','churned')),
      email TEXT,
      clerk_user_id TEXT,
      organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
      source_code TEXT REFERENCES referral_sources(code) ON UPDATE CASCADE,
      attribution_model TEXT NOT NULL DEFAULT 'first_touch',
      first_touch_at TIMESTAMPTZ,
      revenue_cents INTEGER,
      payout_owed_cents INTEGER,
      payout_paid_at TIMESTAMPTZ,
      raw_payload JSONB,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversions_kind ON conversions (kind, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversions_source ON conversions (source_code, kind, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversions_user ON conversions (clerk_user_id) WHERE clerk_user_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversions_email ON conversions (email) WHERE email IS NOT NULL`;

  // Discovery agent run history — every USAspending → ICP → Hunter pass
  // records a row here. /admin/discovery uses this to show "last run"
  // without re-fetching, and the daily cron audit lives here too.
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron','admin','manual')),
      params JSONB NOT NULL,
      target_count INTEGER,
      range_start DATE NOT NULL,
      range_end DATE NOT NULL,
      awards_fetched INTEGER NOT NULL DEFAULT 0,
      pages_scanned INTEGER NOT NULL DEFAULT 1,
      prospects_written INTEGER NOT NULL DEFAULT 0,
      prospects_updated INTEGER NOT NULL DEFAULT 0,
      prospects_rejected INTEGER NOT NULL DEFAULT 0,
      contacts_attempted INTEGER NOT NULL DEFAULT 0,
      contacts_written INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      dry_run BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_discovery_runs_created ON discovery_runs (created_at DESC)`;
  await sql`ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS ai_reviewed INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS ai_kept INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS ai_input_tokens INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS ai_output_tokens INTEGER NOT NULL DEFAULT 0`;
}

/**
 * Cache the init promise so concurrent callers share one migration run per
 * cold start. Without this, every API route calling `initDb()` would issue
 * the full DDL set in parallel.
 *
 * Cross-instance race: when two serverless cold-starts run `initDb()` at the
 * same time, `CREATE TABLE IF NOT EXISTS` is NOT atomic with respect to the
 * implicit row-type creation — both processes see "table doesn't exist",
 * both try to insert into `pg_type`, and one fails with 23505 on
 * `pg_type_typname_nsp_index`. The error is benign (the table now exists),
 * so we retry once. The retry's IF NOT EXISTS guards short-circuit because
 * the racing instance has finished creating everything.
 */
let _initPromise: Promise<void> | null = null;
export function ensureDbReady(): Promise<void> {
  if (!_initPromise) {
    _initPromise = runInitWithRaceRetry().catch((err) => {
      _initPromise = null;
      throw err;
    });
  }
  return _initPromise;
}

async function runInitWithRaceRetry(): Promise<void> {
  try {
    await runInitDdl();
  } catch (err) {
    if (isPgCatalogRaceError(err)) {
      // Another instance won the race and finished creating the schema.
      // Re-run; every IF NOT EXISTS / IF EXISTS guard now no-ops.
      await runInitDdl();
      return;
    }
    throw err;
  }
}

function isPgCatalogRaceError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; constraint?: string; table?: string };
  if (e.code !== "23505") return false;
  // pg_type / pg_class / pg_namespace duplicate-key races during DDL.
  if (e.table === "pg_type" || e.table === "pg_class") return true;
  if (
    e.constraint === "pg_type_typname_nsp_index" ||
    e.constraint === "pg_class_relname_nsp_index"
  ) {
    return true;
  }
  return false;
}
