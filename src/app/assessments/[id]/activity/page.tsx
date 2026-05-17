import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
import {
  listAuditEventsForAssessment,
  type AuditLogRow,
} from "@/lib/security/audit-log";

/**
 * User-visible activity timeline.
 *
 * Every state-change event we record to `audit_log` shows up here in
 * reverse-chronological order — affirmation signed, SPRS filed, evidence
 * uploaded, scope changes, AO email rotations, etc. This is the "what
 * happened to my CMMC posture" view a prime or auditor would walk if they
 * asked for it, and the same backing data sealed into the deliverables ZIP
 * for FAR 4.703 / 32 CFR § 170 six-year retention.
 *
 * Server-rendered. Caller MUST own the assessment (tenant-scoped via
 * `getAssessmentForUser`).
 */
export default async function AssessmentActivityPage(
  props: PageProps<"/assessments/[id]/activity">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const events = await listAuditEventsForAssessment(
    ctx.assessment.id,
    ctx.organization.id,
  );
  // Newest first for the on-screen timeline.
  const ordered = [...events].reverse();
  const grouped = groupByDay(ordered);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 md:px-10 md:py-16">
      <div className="mb-8">
        <Link
          href={`/assessments/${id}`}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f8f6d] hover:text-[#10231d]"
        >
          &larr; Back to assessment
        </Link>
        <h1 className="mt-4 font-serif text-4xl font-normal leading-[1.05] tracking-[-0.03em] text-[#0e2a23] md:text-5xl">
          Activity log.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-[1.6] text-[#5a7d70]">
          Every state-change on this assessment &mdash; signatures, SPRS
          filings, evidence uploads, scope edits, AO rotations, connector
          activity. Same data sealed into the deliverables ZIP for FAR 4.703 /
          32 CFR &sect; 170 six-year retention; this view is for you, your
          AO, and any prime who asks.
        </p>
        <p className="mt-2 text-xs text-[#5a7d70]">
          {events.length} event{events.length === 1 ? "" : "s"} on record
          &middot; newest first
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="border border-dashed border-[#cfe3d9] bg-[#f1f6f3] p-8 text-center text-sm text-[#5a7d70]">
          No activity recorded yet. Events will appear here as you walk
          practices, upload evidence, and file with SPRS.
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((day) => (
            <section key={day.iso}>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                {day.label}
              </h2>
              <ol className="relative border-l-2 border-[#cfe3d9] pl-5">
                {day.events.map((ev) => {
                  const meta = describeAction(ev);
                  return (
                    <li key={ev.id} className="relative mb-5 last:mb-0">
                      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-[#2f8f6d] bg-white" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-semibold text-[#0e2a23]">
                          {meta.title}
                        </div>
                        <time
                          dateTime={ev.created_at}
                          className="text-[11px] font-medium text-[#5a7d70]"
                        >
                          {new Date(ev.created_at).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" },
                          )}
                        </time>
                      </div>
                      {meta.detail ? (
                        <div className="mt-1 text-sm text-[#5a7d70]">
                          {meta.detail}
                        </div>
                      ) : null}
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#5a7d70]/70">
                        {ev.action}
                        {ev.resource_type && ev.resource_id
                          ? ` · ${ev.resource_type}:${ev.resource_id.slice(0, 8)}`
                          : ""}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

type DayBucket = {
  iso: string;
  label: string;
  events: AuditLogRow[];
};

function groupByDay(events: AuditLogRow[]): DayBucket[] {
  const buckets = new Map<string, AuditLogRow[]>();
  for (const ev of events) {
    const d = new Date(ev.created_at);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = buckets.get(iso) ?? [];
    list.push(ev);
    buckets.set(iso, list);
  }
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400_000);
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    const sameYear = d.getFullYear() === today.getFullYear();
    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    });
  };
  return Array.from(buckets.entries()).map(([iso, evs]) => ({
    iso,
    label: fmt(iso),
    events: evs,
  }));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Friendly labels for the major action types. Anything not mapped falls
// through to the raw action code (still rendered in the small mono caption).
function describeAction(ev: AuditLogRow): { title: string; detail?: string } {
  const m = ev.metadata ?? {};
  switch (ev.action) {
    case "assessment.attested":
      return {
        title: "Annual affirmation signed",
        detail: "Senior official affirmed and locked the cycle.",
      };
    case "assessment.signed":
      return { title: "Affirmation submitted to AO for signature" };
    case "assessment.sprs_filed":
      return {
        title: "SPRS filing recorded",
        detail: typeof m.statusDate === "string"
          ? `CMMC Status Date: ${m.statusDate}`
          : undefined,
      };
    case "assessment.sprs_filing_amended":
      return { title: "SPRS filing details amended" };
    case "assessment.material_change_reviewed":
      return {
        title: "Material-change interview completed",
        detail: m.requiredReassessment
          ? "Scope changed — re-affirmation required."
          : "No material change — carry-forward preserved.",
      };
    case "assessment.material_change_filed":
      return { title: "Material change filed with SPRS" };
    case "evidence.uploaded":
    case "manual_evidence.uploaded":
      return {
        title: "Evidence uploaded",
        detail:
          typeof m.controlId === "string"
            ? `Practice ${m.controlId}`
            : undefined,
      };
    case "evidence.deleted":
      return { title: "Evidence file deleted" };
    case "evidence.tagged":
      return { title: "Evidence tagged to a practice" };
    case "evidence.untagged":
      return { title: "Evidence detached from a practice" };
    case "evidence.generated":
      return { title: "Evidence generated by the platform" };
    case "evidence.vault_entry":
      return { title: "Evidence vaulted (encrypted at rest)" };
    case "evidence.marked_final":
      return { title: "Evidence marked final" };
    case "evidence.method_set":
      return { title: "Evidence collection method recorded" };
    case "evidence.rejected_mime":
      return { title: "Evidence upload rejected (file type)" };
    case "bid_package.exported":
      return {
        title: "Sealed L1 record bundle downloaded",
        detail: "ZIP with SSP, signed memo, evidence, audit log, signature manifest.",
      };
    case "bid_packet.exported":
      return { title: "Bid packet (prime-facing) downloaded" };
    case "organization.fields_updated":
      return { title: "Organization profile updated" };
    case "organization.sam_uei_validated":
      return { title: "SAM.gov UEI validated" };
    case "connector.connected":
      return {
        title: "Connector authorized",
        detail:
          typeof m.provider === "string" ? `Provider: ${m.provider}` : undefined,
      };
    case "connector.revoked":
      return { title: "Connector disconnected" };
    case "connector.refresh_failed":
      return { title: "Connector token refresh failed" };
    case "trust_page.published":
      return { title: "Public Verified page published" };
    case "trust_page.unpublished":
      return { title: "Public Verified page hidden" };
    case "trust_page.provisioned":
      return { title: "Custodia Verification ID provisioned" };
    case "trust_page.rotated":
      return { title: "Verification slug rotated" };
    case "trust_page.updated":
      return { title: "Verified page settings updated" };
    case "scope_inventory.added":
      return { title: "Scope inventory: asset added" };
    case "scope_inventory.retired":
      return { title: "Scope inventory: asset retired" };
    case "scope_inventory.updated":
      return { title: "Scope inventory: asset updated" };
    case "esp_registry.added":
    case "esp_registry.updated":
    case "esp_registry.deleted":
      return { title: "External Service Provider registry change" };
    case "specialized_asset.added":
    case "specialized_asset.updated":
    case "specialized_asset.deleted":
      return { title: "Specialized asset registry change" };
    case "exception.declared":
      return { title: "Exception declared" };
    case "exception.cleared":
      return { title: "Exception cleared" };
    case "milestone.added":
      return { title: "Milestone added" };
    case "milestone.deleted":
      return { title: "Milestone removed" };
    case "renewal_reminder.sent":
      return {
        title: "Renewal reminder emailed",
        detail:
          typeof m.window === "number"
            ? `${m.window}-day notice sent to the senior official.`
            : undefined,
      };
    case "narrative.drafted":
      return { title: "Narrative drafted" };
    case "narrative.saved":
      return { title: "Narrative saved" };
    case "narrative.critiqued":
      return { title: "Narrative critiqued by AI reviewer" };
    case "sprs_quiz.submitted":
      return { title: "SPRS readiness quiz submitted" };
    default:
      return { title: prettyAction(ev.action) };
  }
}

function prettyAction(raw: string): string {
  return raw
    .split(/[._]/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}
