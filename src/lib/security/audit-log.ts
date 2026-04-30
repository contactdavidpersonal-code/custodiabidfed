import { getSql } from "@/lib/db";

export type AuditAction =
  | "assessment.attested"
  | "assessment.signed"
  | "evidence.uploaded"
  | "evidence.viewed"
  | "evidence.deleted"
  | "evidence.rejected_mime"
  | "organization.fields_updated"
  | "cron.unauthorized"
  | "cron.executed"
  | "auth.unauthorized"
  | "rate_limit.exceeded";

export type AuditEvent = {
  action: AuditAction;
  userId?: string | null;
  organizationId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append an entry to the security audit log. Required for CMMC L1 evidentiary
 * coverage of attestation, evidence handling, and access-control events.
 *
 * Failure to write an audit row is logged but never thrown — we don't want a
 * write failure to block the underlying user action. Production deployments
 * should monitor for `[audit] insert failed` log lines.
 */
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO audit_log
        (action, user_id, organization_id, resource_type, resource_id,
         ip, user_agent, metadata)
      VALUES
        (${event.action},
         ${event.userId ?? null},
         ${event.organizationId ?? null},
         ${event.resourceType ?? null},
         ${event.resourceId ?? null},
         ${event.ip ?? null},
         ${event.userAgent ?? null},
         ${JSON.stringify(event.metadata ?? {})}::jsonb)
    `;
  } catch (err) {
    console.error("[audit] insert failed:", event.action, err);
  }
}

/** Extract IP + UA from a Request for audit logging. */
export function auditContextFromRequest(req: Request): {
  ip: string;
  userAgent: string;
} {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}
