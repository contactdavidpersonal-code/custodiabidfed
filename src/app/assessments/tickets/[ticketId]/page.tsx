import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  getEscalationForOrg,
  listMessages,
  markOfficerMessagesReadByUser,
  type EscalationMessageRow,
  type EscalationRow,
} from "@/lib/escalations";
import { replyToTicketAction } from "../actions";

const STATUS_LABEL: Record<EscalationRow["status"], string> = {
  open: "Open · awaiting officer",
  acknowledged: "Officer responded",
  scheduled: "Officer scheduled a session",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const URGENCY_TONE: Record<EscalationRow["urgency"], string> = {
  routine: "bg-slate-200 text-slate-800",
  priority: "bg-amber-500 text-slate-900",
  urgent: "bg-rose-600 text-white",
};

export default async function TicketThreadPage(
  props: PageProps<"/assessments/tickets/[ticketId]">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const org = await ensureOrgForUser(userId);
  const { ticketId } = await props.params;
  const ticket = await getEscalationForOrg(ticketId, org.id);
  if (!ticket) notFound();

  await markOfficerMessagesReadByUser(ticket.id, org.id);
  const messages = await listMessages(ticket.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/assessments/tickets"
        className="text-xs font-bold uppercase tracking-[0.2em] text-[#5a7d70] hover:text-[#10231d]"
      >
        ← All tickets
      </Link>

      <header className="mt-4 border-b border-[#cfe3d9] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${URGENCY_TONE[ticket.urgency]}`}
          >
            {ticket.urgency}
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900 ring-1 ring-emerald-200">
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>
        <h1 className="mt-3 font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
          {ticket.topic}
        </h1>
        <p className="mt-2 text-xs text-[#7a9c90]">
          Opened {new Date(ticket.created_at).toLocaleString()} · Ticket{" "}
          <span className="font-mono">{ticket.id.slice(0, 8)}</span>
        </p>
      </header>

      <ol className="mt-6 space-y-4">
        {messages.map((m) => (
          <MessageBlock key={m.id} message={m} />
        ))}
      </ol>

      {ticket.status !== "resolved" && ticket.status !== "dismissed" && (
        <form
          action={replyToTicketAction}
          className="mt-8 space-y-3  border border-[#cfe3d9] bg-white p-5"
        >
          <input type="hidden" name="escalationId" value={ticket.id} />
          <label
            htmlFor="body"
            className="block text-xs font-bold uppercase tracking-[0.18em] text-[#10231d]"
          >
            Reply
          </label>
          <textarea
            id="body"
            name="body"
            required
            minLength={8}
            maxLength={8000}
            rows={5}
            placeholder="Add context, answer the officer's question, or push back."
            className="w-full  border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none focus:ring-2 focus:ring-[#2f8f6d]/20"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#7a9c90]">
              Sent to the officer at <strong>support@custodia.dev</strong>.
            </p>
            <button
              type="submit"
              className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
            >
              Send reply
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function MessageBlock({ message }: { message: EscalationMessageRow }) {
  const isOfficer = message.sender_type === "officer";
  const isSystem = message.sender_type === "system";
  const tone = isOfficer
    ? "border-emerald-300 bg-emerald-50"
    : isSystem
      ? "border-slate-200 bg-slate-50"
      : "border-[#cfe3d9] bg-white";
  const label = isOfficer
    ? `Custodia officer${message.sender_email ? ` · ${message.sender_email}` : ""}`
    : isSystem
      ? "System"
      : "You";
  return (
    <li className={` border p-4 ${tone}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#10231d]">
          {label}
        </span>
        <span className="text-[11px] text-[#7a9c90]">
          {new Date(message.created_at).toLocaleString()}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#10231d]">
        {message.body}
      </p>
    </li>
  );
}
