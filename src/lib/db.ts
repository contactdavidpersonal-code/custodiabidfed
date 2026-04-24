import { neon } from "@neondatabase/serverless";

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

export async function initDb() {
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
  // legacy column and table. No-op on fresh installs.
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
  await sql`
    UPDATE organizations
    SET owner_user_id = SUBSTRING(clerk_org_id FROM 6)
    WHERE owner_user_id IS NULL
      AND clerk_org_id IS NOT NULL
      AND clerk_org_id LIKE 'solo:%'
  `;
  await sql`ALTER TABLE organizations DROP COLUMN IF EXISTS clerk_org_id`;
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
}
