import type { EscalationRow } from "@/lib/escalations";
import { dismissEscalationAction } from "./escalation-actions";

const urgencyTone: Record<
  EscalationRow["urgency"],
  { ring: string; pill: string; label: string }
> = {
  urgent: {
    ring: "border-rose-300 bg-rose-50",
    pill: "bg-rose-600 text-white",
    label: "Urgent",
  },
  priority: {
    ring: "border-amber-300 bg-amber-50",
    pill: "bg-amber-500 text-slate-900",
    label: "Priority",
  },
  routine: {
    ring: "border-slate-300 bg-white",
    pill: "bg-slate-200 text-slate-800",
    label: "Routine",
  },
};

/**
 * Shown on /assessments when Charlie has escalated something to a real
 * Custodia Compliance Officer. Two paths off the banner:
 *   1. Add Custodia Officer ($297/mo) — full self-service + written officer
 *      tickets + audit support, the right call when CMMC L1 work is going
 *      to keep happening.
 *   2. Security consulting — scoped engagement with a credentialed officer
 *      for needs beyond L1 (L2/DFARS 7012, FedRAMP prep, prime audits,
 *      incident response, etc.).
 *
 * For accounts that already have the officer feature (legacy plan or
 * $297 tier) the cards collapse to a single "Talk to your officer" CTA.
 */
export function OfficerUpsellBanner({
  escalations,
  officerEnabled = false,
}: {
  escalations: EscalationRow[];
  /** Account already has `custodia_officer` feature. */
  officerEnabled?: boolean;
}) {
  if (escalations.length === 0) return null;

  const top = escalations[0];
  const extra = escalations.length - 1;
  const tone = urgencyTone[top.urgency];

  return (
    <section
      className={`mb-10  border-2 p-6 shadow-sm md:p-8 ${tone.ring}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.pill}`}
            >
              {tone.label}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              Charlie flagged this for a human
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            {top.topic}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
            {top.summary}
          </p>
          {extra > 0 && (
            <p className="mt-2 text-xs font-medium text-slate-600">
              +{extra} more open escalation{extra === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <form action={dismissEscalationAction}>
          <input type="hidden" name="escalationId" value={top.id} />
          <button
            type="submit"
            className=" border border-slate-300 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-white"
          >
            Dismiss
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {officerEnabled ? (
          <UpsellCard
            tier="Open an officer ticket"
            price="Included"
            cadence="with your plan"
            pitch="Your account already has Custodia Officer. Open a written ticket and a credentialed officer will reply inside the platform — routine within 1 business day, priority in 4h, urgent in 1h."
            cta="Open a ticket"
            href="/assessments/tickets/new"
            accent="amber"
          />
        ) : (
          <UpsellCard
            tier="Add Custodia Officer"
            price="+$148"
            cadence="per month on top of your $149 plan ($297/mo total)"
            pitch="Self Service + a credentialed human officer. Unlimited tickets, officer-led audit support, pre-submission review. The right call if CMMC L1 work is going to keep happening — or if you want a human on call for the awkward 5%."
            cta="Upgrade my plan"
            href="/upgrade?plan=bidfedcmmc_self_service_custodia_officer_"
            accent="amber"
          />
        )}
        <UpsellCard
          tier="Security consulting"
          price="Scoped"
          cadence="fixed-fee engagement"
          pitch="Need help beyond CMMC L1? Talk to a credentialed Custodia officer about L2 / DFARS 7012, FedRAMP prep, prime audit defense, incident response, or custom security work. Scoped engagements that move you forward."
          cta="Book a scoping call"
          href="mailto:officers@custodia.us?subject=Security%20consulting%20%E2%80%94%20%20continued%20federal%20compliance"
          accent="slate"
        />
      </div>
    </section>
  );
}

function UpsellCard({
  tier,
  price,
  cadence,
  pitch,
  cta,
  href,
  accent,
}: {
  tier: string;
  price: string;
  cadence: string;
  pitch: string;
  cta: string;
  href: string;
  accent: "amber" | "slate";
}) {
  const btn =
    accent === "amber"
      ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
      : "bg-slate-900 text-white hover:bg-slate-800";
  return (
    <div className="flex flex-col justify-between  border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            {tier}
          </h3>
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums text-slate-900">
              {price}
            </div>
            <div className="text-[11px] text-slate-500">{cadence}</div>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{pitch}</p>
      </div>
      <a
        href={href}
        className={`mt-4 inline-flex items-center justify-center  px-4 py-2.5 text-sm font-bold shadow-sm transition-colors ${btn}`}
      >
        {cta} &rarr;
      </a>
    </div>
  );
}
