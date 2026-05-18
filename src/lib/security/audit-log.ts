import { getSql } from "@/lib/db";

export type AuditAction =
  | "assessment.attested"
  | "assessment.signed"
  | "evidence.uploaded"
  | "evidence.viewed"
  | "evidence.deleted"
  | "evidence.rejected_mime"
  | "evidence.tagged"
  | "evidence.untagged"
  | "evidence.generated"
  | "evidence.vault_entry"
  | "bid_package.exported"
  | "bid_packet.exported"
  | "organization.fields_updated"
  | "cron.unauthorized"
  | "cron.executed"
  | "cron.audit_retention.purged"
  | "auth.unauthorized"
  | "rate_limit.exceeded"
  | "connector.connected"
  | "connector.revoked"
  | "connector.refresh_failed"
  | "manual_evidence.uploaded"
  | "trust_page.published"
  | "trust_page.unpublished"
  | "trust_page.provisioned"
  | "trust_page.updated"
  | "trust_page.rotated"
  | "sprs_quiz.submitted"
  | "assessment.sprs_filed"
  | "assessment.sprs_filing_amended"
  | "email.sprs_filed.failed"
  | "scope_inventory.added"
  | "scope_inventory.retired"
  | "scope_inventory.updated"
  | "esp_registry.added"
  | "esp_registry.updated"
  | "esp_registry.deleted"
  | "specialized_asset.added"
  | "specialized_asset.updated"
  | "specialized_asset.deleted"
  | "exception.declared"
  | "exception.cleared"
  | "milestone.added"
  | "milestone.deleted"
  | "organization.sam_uei_validated"
  | "assessment.material_change_reviewed"
  | "assessment.material_change_filed"
  | "evidence.method_set"
  | "evidence.marked_final"
  | "narrative.drafted"
  | "narrative.saved"
  | "narrative.critiqued"
  | "renewal_reminder.sent";

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

/**
 * Row shape for audit-log exports. Used by the sealed L1 record bundle
 * (32 CFR § 170 / FAR 4.703 six-year retention) — callers must enforce
 * tenant scoping before calling.
 */
export type AuditLogRow = {
  id: string;
  action: string;
  user_id: string | null;
  organization_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * List every audit event tied to an assessment OR to its parent organization.
 * Used by the sealed-record bundle on the deliverables page: contractors must
 * retain the full state-change history for six years after final payment
 * (FAR 4.703 + 32 CFR § 170 record-keeping). Caller MUST have already
 * tenant-scoped the assessment (e.g. via `getAssessmentForUser`) — this
 * helper does no auth.
 */
export async function listAuditEventsForAssessment(
  assessmentId: string,
  organizationId: string,
): Promise<AuditLogRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, action, user_id, organization_id, resource_type, resource_id,
           ip, user_agent, metadata, created_at
    FROM audit_log
    WHERE (resource_type = 'assessment' AND resource_id = ${assessmentId})
       OR (organization_id = ${organizationId}::uuid AND (
            resource_type IS NULL
            OR resource_type IN ('organization', 'evidence', 'trust_page', 'connector', 'scope_inventory', 'esp_registry', 'specialized_asset')
          ))
    ORDER BY created_at ASC
  `) as AuditLogRow[];
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
