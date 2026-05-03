import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  listAllEscalationsForOrg,
  type EscalationWithCounts,
} from "@/lib/escalations";

const STATUS_LABEL: Record<EscalationWithCounts["status"], string> = {
  open: "Open",
  acknowledged: "Officer responded",
  scheduled: "Scheduled",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const STATUS_TONE: Record<EscalationWithCounts["status"], string> = {
  open: "bg-amber-100 text-amber-900 ring-amber-200",
  acknowledged: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  scheduled: "bg-sky-100 text-sky-900 ring-sky-200",
  resolved: "bg-slate-100 text-slate-700 ring-slate-200",
  dismissed: "bg-slate-100 text-slate-500 ring-slate-200",
};

const URGENCY_TONE: Record<EscalationWithCounts["urgency"], string> = {
  routine: "bg-slate-200 text-slate-800",
  priority: "bg-amber-500 text-slate-900",
  urgent: "bg-rose-600 text-white",
};

export default async function TicketsIndexPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const org = await ensureOrgForUser(userId);
  const tickets = await listAllEscalationsForOrg(org.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            Officer support
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
            Your officer tickets
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5a7d70]">
            Open a ticket and a Custodia compliance officer answers in writing.
            Replies thread back into this view — no inbox-hopping required.
          </p>
        </div>
        <Link
          href="/assessments/tickets/new"
          className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
        >
          + Ask a human officer
        </Link>
      </header>

      {tickets.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/assessments/tickets/${t.id}`}
                className="block  border border-[#cfe3d9] bg-white p-5 transition-colors hover:border-[#2f8f6d] hover:bg-[#f7fcf9]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${URGENCY_TONE[t.urgency]}`}
                      >
                        {t.urgency}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${STATUS_TONE[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                      {t.unread_user_count > 0 && (
                        <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {t.unread_user_count} new
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 truncate text-base font-bold text-[#10231d]">
                      {t.topic}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-[#5a7d70]">
                      {t.summary}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#7a9c90]">
                    <div>{formatRelative(t.last_message_at)}</div>
                    <div className="mt-1">
                      {t.message_count} message{t.message_count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className=" border border-dashed border-[#cfe3d9] bg-white p-10 text-center">
      <h2 className="font-serif text-xl font-bold text-[#10231d]">
        No tickets yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#5a7d70]">
        Stuck on a control? Need a sanity check on your scope? Open a ticket
        and a real Custodia officer will reply by email — and the reply shows
        up right back here.
      </p>
      <Link
        href="/assessments/tickets/new"
        className="mt-6 inline-block  bg-[#0e2a23] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
      >
        Open your first ticket
      </Link>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
