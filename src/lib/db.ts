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
