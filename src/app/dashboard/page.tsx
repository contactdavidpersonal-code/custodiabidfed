import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientAction, updateClientStageAction } from "./actions";
import { getSql, initDb, sprintStages } from "@/lib/db";
import { AdminLink } from "@/components/AdminLink";

type ClientRow = {
  id: number;
  name: string;
  company: string;
  email: string | null;
  sprint_stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WaitlistRow = {
  id: number;
  name: string | null;
  company: string | null;
  email: string;
  created_at: string;
};

const stageLabels: Record<(typeof sprintStages)[number], string> = {
  "lead-intake": "Lead intake",
  "sam-registration": "SAM registration",
  "ssp-draft": "SSP draft",
  "controls-implementation": "Controls implementation",
  "evidence-review": "Evidence review",
  "bid-ready": "Bid ready",
  retainer: "Retainer",
};

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  await initDb();
  const sql = getSql();

  const clients = (await sql`
    SELECT id, name, company, email, sprint_stage, notes, created_at, updated_at
    FROM clients
    WHERE owner_user_id = ${userId}
    ORDER BY updated_at DESC, created_at DESC
  `) as ClientRow[];

  const waitlist = (await sql`
    SELECT id, name, company, email, created_at
    FROM waitlist
    ORDER BY created_at DESC
    LIMIT 8
  `) as WaitlistRow[];

  const stageCounts = sprintStages.map((stage) => ({
    stage,
    count: clients.filter((client) => client.sprint_stage === stage).length,
  }));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#052e22] text-[#f9faf9]">
      {/* Ambient glow accents — luxe atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#bef4be] opacity-[0.06] blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-0 h-[420px] w-[420px] rounded-full bg-[#bef4be] opacity-[0.04] blur-[120px]"
      />

      {/* Minimal top nav — Rhetorich pattern */}
      <header className="relative z-10 border-b border-[#bef4be]/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 md:px-10 md:py-6">
          <Link href="/" className="font-serif text-2xl tracking-tight text-white">
            Custodia<span className="text-[#bef4be]">.</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/"
              className="hidden rounded-full border border-[#bef4be]/30 bg-[#063f2e]/40 px-5 py-2 text-sm font-medium text-[#bef4be] backdrop-blur transition-colors hover:border-[#bef4be]/60 hover:bg-[#063f2e]/70 md:inline-flex"
            >
              Back to site
            </Link>
            <AdminLink className="rounded-full border border-[#bef4be]/30 bg-[#063f2e]/40 px-5 py-2 text-sm font-medium text-[#bef4be] backdrop-blur transition-colors hover:border-[#bef4be]/60 hover:bg-[#063f2e]/70" />
            <div className="ml-1">
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-12 pt-16 md:px-10 md:pb-16 md:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#bef4be]/25 bg-[#063f2e]/30 px-4 py-1.5 text-xs font-medium tracking-wide text-[#bef4be] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#bef4be]" />
          Founder dashboard
        </p>
        <h1 className="mt-6 max-w-4xl font-serif text-5xl font-normal leading-[1.05] tracking-[-0.04em] text-white md:text-7xl">
          Run the sprint like<br />you mean it.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-[1.6] text-white/70 md:text-lg">
          Move startups from lead intake to bid-ready in fourteen days — then quietly hold the line on
          their CMMC posture through the managed retainer.
        </p>
      </section>

      {/* Metrics row */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Active clients" value={String(clients.length)} />
          <MetricCard
            label="Bid-ready"
            value={String(stageCounts.find((entry) => entry.stage === "bid-ready")?.count ?? 0)}
          />
          <MetricCard
            label="On retainer"
            value={String(stageCounts.find((entry) => entry.stage === "retainer")?.count ?? 0)}
          />
          <MetricCard label="Waitlist leads" value={String(waitlist.length)} />
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-[#bef4be]/15 bg-[#063f2e]/40 p-8 backdrop-blur-sm">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl font-normal leading-tight tracking-[-0.03em] text-white md:text-4xl">
                  Sprint pipeline
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-[1.6] text-white/65">
                  The delivery path: intake → SAM.gov → SSP → controls → evidence → bid-ready → retainer.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {stageCounts.map(({ stage, count }) => (
                <div
                  key={stage}
                  className="rounded-xl border border-[#bef4be]/10 bg-[#04241b]/60 p-5 transition-colors hover:border-[#bef4be]/25"
                >
                  <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-[#bef4be]">
                    <span className="h-1 w-1 rounded-full bg-[#bef4be]" />
                    {stageLabels[stage]}
                  </div>
                  <div className="mt-4 font-serif text-4xl font-normal tracking-[-0.04em] text-white">
                    {count}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 overflow-hidden rounded-xl border border-[#bef4be]/10">
              <table className="min-w-full divide-y divide-[#bef4be]/10 text-left text-sm">
                <thead className="bg-[#04241b]/70 text-white/60">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-medium uppercase tracking-[0.2em]">Client</th>
                    <th className="px-5 py-4 text-[10px] font-medium uppercase tracking-[0.2em]">Company</th>
                    <th className="px-5 py-4 text-[10px] font-medium uppercase tracking-[0.2em]">Stage</th>
                    <th className="px-5 py-4 text-[10px] font-medium uppercase tracking-[0.2em]">Notes</th>
                    <th className="px-5 py-4 text-[10px] font-medium uppercase tracking-[0.2em]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bef4be]/8 bg-[#03201a]/50">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-white/45">
                        No clients yet. Add your first sprint client using the intake form.
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="align-top transition-colors hover:bg-[#04241b]/50">
                        <td className="px-5 py-5">
                          <div className="font-medium text-white">{client.name}</div>
                          <div className="mt-1 text-xs text-white/45">{client.email ?? "No email added"}</div>
                        </td>
                        <td className="px-5 py-5 text-white/75">{client.company}</td>
                        <td className="px-5 py-5">
                          <form action={updateClientStageAction} className="flex items-center gap-2">
                            <input type="hidden" name="clientId" value={client.id} />
                            <select
                              name="sprintStage"
                              defaultValue={client.sprint_stage}
                              className="min-w-44 rounded-full border border-[#bef4be]/20 bg-[#04241b] px-4 py-2 text-sm text-white outline-none transition-colors focus:border-[#bef4be]/60"
                            >
                              {sprintStages.map((stage) => (
                                <option key={stage} value={stage}>
                                  {stageLabels[stage]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-full bg-[#bef4be] px-4 py-2 text-xs font-medium tracking-tight text-[#063f2e] transition-colors hover:bg-white"
                            >
                              Save
                            </button>
                          </form>
                        </td>
                        <td className="px-5 py-5 text-white/65">{client.notes || "—"}</td>
                        <td className="px-5 py-5 text-white/45">
                          {new Date(client.updated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-[#bef4be]/30 bg-gradient-to-br from-[#bef4be] to-[#a8e8b0] p-8 text-[#063f2e] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
            <h2 className="font-serif text-3xl font-normal leading-tight tracking-[-0.03em] md:text-4xl">
              Add sprint client
            </h2>
            <p className="mt-3 text-sm leading-[1.6] text-[#063f2e]/75">
              Add a startup as soon as they engage. This becomes the operating record for their sprint.
            </p>
            <form action={createClientAction} className="mt-7 space-y-4">
              <Field label="Founder name" name="name" placeholder="Jane Founder" required />
              <Field label="Company" name="company" placeholder="Acme Defense AI" required />
              <Field label="Email" name="email" type="email" placeholder="jane@acme.ai" />
              <label className="block">
                <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-[#063f2e]/70">
                  Notes
                </span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Current contract target, blockers, timelines, or special scope..."
                  className="w-full rounded-xl border border-[#063f2e]/15 bg-white/70 px-4 py-3 text-sm text-[#063f2e] outline-none transition-colors placeholder:text-[#063f2e]/40 focus:border-[#063f2e]/50 focus:bg-white"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#063f2e] px-6 py-3.5 text-sm font-medium tracking-tight text-[#bef4be] transition-colors hover:bg-[#052e22]"
              >
                Create client record
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1.5 1.5L6 6l-4.5 4.5" />
                </svg>
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-[#bef4be]/15 bg-[#063f2e]/40 p-8 backdrop-blur-sm">
            <h2 className="font-serif text-3xl font-normal leading-tight tracking-[-0.03em] text-white md:text-4xl">
              Latest waitlist leads
            </h2>
            <p className="mt-3 text-sm leading-[1.6] text-white/65">
              Incoming landing-page demand captured from the bootcamp application form.
            </p>
            <div className="mt-7 space-y-3">
              {waitlist.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#bef4be]/15 px-5 py-8 text-center text-sm text-white/45">
                  No waitlist entries yet.
                </div>
              ) : (
                waitlist.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-xl border border-[#bef4be]/10 bg-[#04241b]/60 px-5 py-4 transition-colors hover:border-[#bef4be]/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{lead.name || "Unnamed lead"}</div>
                        <div className="mt-1 text-sm text-white/65">{lead.company || "No company provided"}</div>
                        <div className="mt-1 text-xs text-white/45">{lead.email}</div>
                      </div>
                      <div className="text-xs text-white/45">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

      {/* Closing strip */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:px-10">
        <p className="text-center text-xs tracking-wide text-white/35">
          Custodia · CMMC L1 sprint operations · grounded in NIST SP 800-171 r2 & FAR 52.204-21
        </p>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#bef4be]/15 bg-[#063f2e]/40 p-6 backdrop-blur-sm transition-colors hover:border-[#bef4be]/30">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#bef4be] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-[0.08]"
      />
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-[#bef4be]">
        <span className="h-1 w-1 rounded-full bg-[#bef4be]" />
        {label}
      </div>
      <div className="mt-4 font-serif text-5xl font-normal tracking-[-0.04em] text-white">{value}</div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-[#063f2e]/70">
        {label}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-[#063f2e]/15 bg-white/70 px-4 py-3 text-sm text-[#063f2e] outline-none transition-colors placeholder:text-[#063f2e]/40 focus:border-[#063f2e]/50 focus:bg-white"
      />
    </label>
  );
}
