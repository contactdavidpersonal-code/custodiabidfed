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
 * Shown on /assessments when the AI officer has escalated something to a real
 * Custodia officer. Surfaces the Bootcamp ($5K 1-week officer-led) and Command
 * ($1K–1.5K/mo retainer) offers as the path from "AI flagged this" to "book a
 * human." See user_custodia.md for offer context.
 */
export function OfficerUpsellBanner({
  escalations,
}: {
  escalations: EscalationRow[];
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
              Your officer flagged this for a human
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
        <UpsellCard
          tier="Bootcamp"
          price="$5,000"
          cadence="one week, flat fee"
          pitch="An officer walks your team through L1 live for a week. Best for service-trade teams or anyone who wants translation, not a wizard."
          cta="Book a Bootcamp officer"
          href="mailto:officers@custodia.us?subject=Bootcamp%20for%20my%20L1%20escalation"
          accent="amber"
        />
        <UpsellCard
          tier="Command"
          price="$1,000–1,500"
          cadence="per month"
          pitch="Fractional officer on retainer. We watch for drift, own your SPRS renewal, and resolve anything the Platform flags."
          cta="Start a Command retainer"
          href="mailto:officers@custodia.us?subject=Command%20retainer%20for%20my%20L1"
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
