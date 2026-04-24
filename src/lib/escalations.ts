import {
  getSql,
  type EscalationStatus,
  type EscalationUrgency,
} from "@/lib/db";

export type EscalationRow = {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  topic: string;
  urgency: EscalationUrgency;
  summary: string;
  status: EscalationStatus;
  assigned_officer_user_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

/**
 * Open escalations for an org — anything the user hasn't dismissed and we
 * haven't resolved yet. Ordered urgent → priority → routine so the upsell
 * banner highlights the hottest request.
 */
export async function listActiveEscalationsForOrg(
  organizationId: string,
): Promise<EscalationRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, conversation_id, topic, urgency, summary,
           status, assigned_officer_user_id, created_at, resolved_at
    FROM officer_escalations
    WHERE organization_id = ${organizationId}
      AND status IN ('open', 'acknowledged', 'scheduled')
    ORDER BY
      CASE urgency WHEN 'urgent' THEN 0 WHEN 'priority' THEN 1 ELSE 2 END,
      created_at DESC
  `) as EscalationRow[];
}

export async function setEscalationStatus(
  escalationId: string,
  organizationId: string,
  status: EscalationStatus,
): Promise<void> {
  const sql = getSql();
  const terminal = status === "resolved" || status === "dismissed";
  if (terminal) {
    await sql`
      UPDATE officer_escalations
      SET status = ${status}, resolved_at = NOW()
      WHERE id = ${escalationId} AND organization_id = ${organizationId}
    `;
  } else {
    await sql`
      UPDATE officer_escalations
      SET status = ${status}, resolved_at = NULL
      WHERE id = ${escalationId} AND organization_id = ${organizationId}
    `;
  }
}
