/**
 * Client-side intake portal — magic-link invitations.
 *
 * An MSP user creates an invitation for a client. The client visits
 * /intake/<token> in their own browser and answers Charlie's questions
 * without needing a Custodia / Clerk account. When they complete a section,
 * the MSP gets notified.
 *
 * Token = 256-bit url-safe random string. Stored in clear (not a secret —
 * the token IS the auth). Single use is NOT enforced; the client can come
 * back to the same link until expiry or revocation.
 */

import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";

export const INTAKE_SECTIONS = ["profile", "boundary"] as const;
export type IntakeSection = (typeof INTAKE_SECTIONS)[number];

export type IntakeInvitationRow = {
  id: string;
  organization_id: string;
  created_by_user_id: string;
  client_email: string;
  client_name: string | null;
  token: string;
  sections: IntakeSection[];
  completed_sections: IntakeSection[];
  last_seen_at: string | null;
  notified_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export function generateInviteToken(): string {
  // 32 bytes → 43 url-safe chars. Plenty of entropy.
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createIntakeInvitation(args: {
  organizationId: string;
  createdByUserId: string;
  clientEmail: string;
  clientName?: string | null;
  sections?: IntakeSection[];
}): Promise<IntakeInvitationRow> {
  const sql = getSql();
  const token = generateInviteToken();
  const sections = args.sections ?? [...INTAKE_SECTIONS];
  const rows = (await sql`
    INSERT INTO intake_invitations
      (organization_id, created_by_user_id, client_email, client_name, token, sections)
    VALUES
      (${args.organizationId}, ${args.createdByUserId}, ${args.clientEmail.trim().toLowerCase()},
       ${args.clientName ?? null}, ${token}, ${sections})
    RETURNING *
  `) as IntakeInvitationRow[];
  return rows[0];
}

export async function getIntakeInvitationByToken(
  token: string,
): Promise<IntakeInvitationRow | null> {
  if (!token || token.length < 16) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT *
    FROM intake_invitations
    WHERE token = ${token}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `) as IntakeInvitationRow[];
  return rows[0] ?? null;
}

export async function listIntakeInvitationsForOrg(
  organizationId: string,
): Promise<IntakeInvitationRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT *
    FROM intake_invitations
    WHERE organization_id = ${organizationId}
    ORDER BY created_at DESC
    LIMIT 100
  `) as IntakeInvitationRow[];
}

export async function touchIntakeInvitation(token: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE intake_invitations
    SET last_seen_at = NOW()
    WHERE token = ${token} AND revoked_at IS NULL
  `;
}

export async function markIntakeSectionComplete(
  token: string,
  section: IntakeSection,
): Promise<IntakeInvitationRow | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE intake_invitations
    SET completed_sections = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(completed_sections || ARRAY[${section}::text])
      )
    ),
    last_seen_at = NOW()
    WHERE token = ${token} AND revoked_at IS NULL
    RETURNING *
  `) as IntakeInvitationRow[];
  return rows[0] ?? null;
}

export async function revokeIntakeInvitation(args: {
  id: string;
  organizationId: string;
}): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE intake_invitations
    SET revoked_at = NOW()
    WHERE id = ${args.id} AND organization_id = ${args.organizationId}
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

export function inviteUrl(token: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "https://custodia.bid";
  const root = base.startsWith("http") ? base : `https://${base}`;
  return `${root.replace(/\/$/, "")}/intake/${token}`;
}
