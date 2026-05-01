import Link from "next/link";
import { createTicketAction } from "../actions";

export default function NewTicketPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/assessments/tickets"
        className="text-xs font-bold uppercase tracking-[0.2em] text-[#5a7d70] hover:text-[#10231d]"
      >
        ← All tickets
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#10231d]">
        Ask a human officer
      </h1>
      <p className="mt-2 text-sm text-[#5a7d70]">
        A Custodia compliance officer answers in writing. Replies thread back
        into the platform — you don&apos;t have to dig through email.
      </p>

      <form
        action={createTicketAction}
        className="mt-8 space-y-6 rounded-sm border border-[#cfe3d9] bg-white p-6"
      >
        <div>
          <label
            htmlFor="topic"
            className="block text-xs font-bold uppercase tracking-[0.18em] text-[#10231d]"
          >
            Topic
          </label>
          <input
            id="topic"
            name="topic"
            required
            maxLength={140}
            placeholder="e.g. Does our HRIS need MFA for AC.L1-3.1.1?"
            className="mt-2 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none focus:ring-2 focus:ring-[#2f8f6d]/20"
          />
        </div>

        <fieldset>
          <legend className="block text-xs font-bold uppercase tracking-[0.18em] text-[#10231d]">
            Urgency
          </legend>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <UrgencyOption
              value="routine"
              defaultChecked
              label="Routine"
              sla="1 business day"
            />
            <UrgencyOption value="priority" label="Priority" sla="4 hours" />
            <UrgencyOption value="urgent" label="Urgent" sla="1 hour" />
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="summary"
            className="block text-xs font-bold uppercase tracking-[0.18em] text-[#10231d]"
          >
            What&apos;s going on?
          </label>
          <textarea
            id="summary"
            name="summary"
            required
            minLength={8}
            maxLength={8000}
            rows={8}
            placeholder="Describe the situation. Include the practice ID, the prime/contract if relevant, and what you've already tried."
            className="mt-2 w-full rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm focus:border-[#2f8f6d] focus:outline-none focus:ring-2 focus:ring-[#2f8f6d]/20"
          />
          <p className="mt-1 text-[11px] text-[#7a9c90]">
            Don&apos;t paste secrets, passwords, or PII. The officer can ask
            for those over a secure channel if needed.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#cfe3d9] pt-4">
          <p className="text-xs text-[#5a7d70]">
            We email <strong>support@custodia.dev</strong>. Their reply lands
            in this ticket.
          </p>
          <button
            type="submit"
            className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-[#bdf2cf] transition-colors hover:bg-[#10231d]"
          >
            Send to an officer
          </button>
        </div>
      </form>
    </main>
  );
}

function UrgencyOption({
  value,
  label,
  sla,
  defaultChecked,
}: {
  value: string;
  label: string;
  sla: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-sm border border-[#cfe3d9] bg-white p-3 transition-colors hover:border-[#2f8f6d] has-[:checked]:border-[#2f8f6d] has-[:checked]:bg-[#f7fcf9]">
      <input
        type="radio"
        name="urgency"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 accent-[#2f8f6d]"
      />
      <div>
        <div className="text-sm font-bold text-[#10231d]">{label}</div>
        <div className="text-[11px] text-[#5a7d70]">{sla}</div>
      </div>
    </label>
  );
}
