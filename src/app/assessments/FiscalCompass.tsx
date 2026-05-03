import Link from "next/link";
import {
  daysUntil,
  fiscalQuarter,
  fiscalYearEnd,
  fiscalYearOf,
  fiscalYearStart,
  type MilestoneRow,
} from "@/lib/fiscal";
import {
  completeMilestoneAction,
  snoozeMilestoneAction,
} from "./milestone-actions";

/**
 * The fiscal-year compass pinned to the top of /assessments. Shows the current
 * FY, countdown to the annual affirmation deadline, current quarter, and the
 * next few upcoming milestones with inline complete/snooze actions.
 */
export function FiscalCompass({
  milestones,
}: {
  milestones: MilestoneRow[];
}) {
  const now = new Date();
  const fy = fiscalYearOf(now);
  const start = fiscalYearStart(fy);
  const end = fiscalYearEnd(fy);
  const q = fiscalQuarter(now);

  const totalDays = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  const elapsed = Math.min(
    totalDays,
    Math.max(
      0,
      Math.round((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    ),
  );
  const fyPercent = Math.round((elapsed / totalDays) * 100);

  const affirmation = milestones.find((m) => m.kind === "affirmation_due");
  const daysToAffirmation = affirmation
    ? daysUntil(affirmation.due_date)
    : Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  const upcoming = milestones
    .filter((m) => !m.completed_at)
    .slice(0, 4);

  return (
    <section className="mb-10  border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            Fiscal year {fy} · Q{q}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {daysToAffirmation <= 0
              ? "Your annual affirmation is due now"
              : `${daysToAffirmation} days until your annual affirmation`}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Federal FY runs Oct 1 — Sep 30. SPRS affirmation is due by Sep 30 each
            year to stay bid-eligible. The officer seeds quarterly checkpoints so
            you stay locked in year over year, not just the day you sign.
          </p>
        </div>
        <div className="min-w-[220px]  border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            FY progress
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums text-slate-900">
              {fyPercent}
            </span>
            <span className="text-lg font-semibold text-slate-400">%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${fyPercent}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {start.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            →{" "}
            {end.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <div className="mb-3 flex items-end justify-between">
          <h3 className="text-sm font-bold tracking-tight text-slate-900">
            Upcoming milestones
          </h3>
          <span className="text-xs text-slate-500">
            {upcoming.length === 0
              ? "All caught up"
              : `Next ${upcoming.length}`}
          </span>
        </div>
        {upcoming.length === 0 ? (
          <div className=" border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center text-sm text-slate-500">
            No pending milestones — the officer will seed new ones for FY{fy + 1}{" "}
            when the next cycle rolls over on Oct 1.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((m) => (
              <MilestoneRowCard key={m.id} milestone={m} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function MilestoneRowCard({ milestone }: { milestone: MilestoneRow }) {
  const days = daysUntil(milestone.due_date);
  const overdue = days < 0;
  const soon = !overdue && days <= 14;
  const tone = overdue
    ? "border-rose-200 bg-rose-50"
    : soon
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white";
  const dateLabel = overdue
    ? `${Math.abs(days)}d overdue`
    : days === 0
      ? "Due today"
      : `${days}d left`;
  const dateTone = overdue
    ? "text-rose-700"
    : soon
      ? "text-amber-800"
      : "text-slate-600";

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3  border px-4 py-3 ${tone}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">
            {milestone.title}
          </span>
          <span className={`text-xs font-semibold ${dateTone}`}>
            · {dateLabel}
          </span>
        </div>
        {milestone.description && (
          <p className="mt-0.5 text-xs text-slate-600">{milestone.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <form action={snoozeMilestoneAction}>
          <input type="hidden" name="milestoneId" value={milestone.id} />
          <input type="hidden" name="days" value="7" />
          <button
            type="submit"
            className=" border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Snooze 7d
          </button>
        </form>
        <form action={completeMilestoneAction}>
          <input type="hidden" name="milestoneId" value={milestone.id} />
          <button
            type="submit"
            className=" bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            Mark done
          </button>
        </form>
        {milestone.kind === "affirmation_due" && milestone.assessment_id && (
          <Link
            href={`/assessments/${milestone.assessment_id}/sign`}
            className=" bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300"
          >
            Sign now &rarr;
          </Link>
        )}
      </div>
    </li>
  );
}
