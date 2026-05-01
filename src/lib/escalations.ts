import {
  escalationUrgencies,
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

export type EscalationMessageRow = {
  id: string;
  escalation_id: string;
  sender_type: "user" | "officer" | "system";
  sender_user_id: string | null;
  sender_email: string | null;
  body: string;
  email_message_id: string | null;
  created_at: string;
  read_by_user_at: string | null;
  read_by_officer_at: string | null;
};

export type EscalationWithCounts = EscalationRow & {
  message_count: number;
  unread_user_count: number;
  last_message_at: string;
};

export function isValidUrgency(value: unknown): value is EscalationUrgency {
  return (
    typeof value === "string" &&
    (escalationUrgencies as readonly string[]).includes(value)
  );
}

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

/**
 * Open a new ticket. Used by the platform "Ask a human officer" form. The
 * initial message body is inserted as the first row of the thread (kind
 * `user`) so the thread view always reflects what the user actually wrote,
 * not the AI's summary.
 */
export async function createUserEscalation(args: {
  organizationId: string;
  userId: string;
  userEmail: string | null;
  topic: string;
  urgency: EscalationUrgency;
  summary: string;
}): Promise<EscalationRow> {
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO officer_escalations
      (organization_id, conversation_id, topic, urgency, summary)
    VALUES (
      ${args.organizationId}::uuid,
      NULL,
      ${args.topic},
      ${args.urgency},
      ${args.summary}
    )
    RETURNING id, organization_id, conversation_id, topic, urgency, summary,
              status, assigned_officer_user_id, created_at, resolved_at
  `) as EscalationRow[];
  const row = inserted[0];
  await appendMessage({
    escalationId: row.id,
    senderType: "user",
    senderUserId: args.userId,
    senderEmail: args.userEmail,
    body: args.summary,
  });
  return row;
}

/**
 * Append a message to a ticket thread. Returns the inserted row so callers
 * can wire it back into UI optimistically and persist email_message_id once
 * the outbound send returns one.
 */
export async function appendMessage(args: {
  escalationId: string;
  senderType: "user" | "officer" | "system";
  senderUserId?: string | null;
  senderEmail?: string | null;
  body: string;
  emailMessageId?: string | null;
}): Promise<EscalationMessageRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO escalation_messages
      (escalation_id, sender_type, sender_user_id, sender_email, body, email_message_id)
    VALUES (
      ${args.escalationId}::uuid,
      ${args.senderType},
      ${args.senderUserId ?? null},
      ${args.senderEmail ?? null},
      ${args.body},
      ${args.emailMessageId ?? null}
    )
    RETURNING id, escalation_id, sender_type, sender_user_id, sender_email,
              body, email_message_id, created_at, read_by_user_at,
              read_by_officer_at
  `) as EscalationMessageRow[];
  return rows[0];
}

export async function setEmailMessageId(
  messageRowId: string,
  emailMessageId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE escalation_messages
    SET email_message_id = ${emailMessageId}
    WHERE id = ${messageRowId}::uuid
  `;
}

export async function getEscalationForOrg(
  escalationId: string,
  organizationId: string,
): Promise<EscalationRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, organization_id, conversation_id, topic, urgency, summary,
           status, assigned_officer_user_id, created_at, resolved_at
    FROM officer_escalations
    WHERE id = ${escalationId}::uuid
      AND organization_id = ${organizationId}::uuid
    LIMIT 1
  `) as EscalationRow[];
  return rows[0] ?? null;
}

/** Just the escalation by id, no auth scope (webhook use only). */
export async function getEscalationById(
  escalationId: string,
): Promise<EscalationRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, organization_id, conversation_id, topic, urgency, summary,
           status, assigned_officer_user_id, created_at, resolved_at
    FROM officer_escalations
    WHERE id = ${escalationId}::uuid
    LIMIT 1
  `) as EscalationRow[];
  return rows[0] ?? null;
}

export async function listMessages(
  escalationId: string,
): Promise<EscalationMessageRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, escalation_id, sender_type, sender_user_id, sender_email,
           body, email_message_id, created_at, read_by_user_at,
           read_by_officer_at
    FROM escalation_messages
    WHERE escalation_id = ${escalationId}::uuid
    ORDER BY created_at ASC
  `) as EscalationMessageRow[];
}

/** All tickets for an org including dismissed/resolved, with thread counts. */
export async function listAllEscalationsForOrg(
  organizationId: string,
): Promise<EscalationWithCounts[]> {
  const sql = getSql();
  return (await sql`
    SELECT e.id, e.organization_id, e.conversation_id, e.topic, e.urgency,
           e.summary, e.status, e.assigned_officer_user_id, e.created_at,
           e.resolved_at,
           COALESCE(m.cnt, 0)::int AS message_count,
           COALESCE(m.unread, 0)::int AS unread_user_count,
           COALESCE(m.last_at, e.created_at) AS last_message_at
    FROM officer_escalations e
    LEFT JOIN (
      SELECT escalation_id,
             COUNT(*) AS cnt,
             SUM(CASE WHEN sender_type = 'officer' AND read_by_user_at IS NULL
                      THEN 1 ELSE 0 END) AS unread,
             MAX(created_at) AS last_at
      FROM escalation_messages
      GROUP BY escalation_id
    ) m ON m.escalation_id = e.id
    WHERE e.organization_id = ${organizationId}::uuid
    ORDER BY
      CASE e.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1
                    WHEN 'scheduled' THEN 2 WHEN 'resolved' THEN 3
                    ELSE 4 END,
      COALESCE(m.last_at, e.created_at) DESC
  `) as EscalationWithCounts[];
}

export async function countUnreadOfficerRepliesForOrg(
  organizationId: string,
): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM escalation_messages m
    JOIN officer_escalations e ON e.id = m.escalation_id
    WHERE e.organization_id = ${organizationId}::uuid
      AND m.sender_type = 'officer'
      AND m.read_by_user_at IS NULL
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export async function markOfficerMessagesReadByUser(
  escalationId: string,
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE escalation_messages
    SET read_by_user_at = NOW()
    WHERE escalation_id = ${escalationId}::uuid
      AND sender_type = 'officer'
      AND read_by_user_at IS NULL
      AND escalation_id IN (
        SELECT id FROM officer_escalations
        WHERE organization_id = ${organizationId}::uuid
      )
  `;
}
