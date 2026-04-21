import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClientAction, updateClientStageAction } from "./actions";
import { getSql, initDb, sprintStages } from "@/lib/db";

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
    <main className="min-h-screen bg-[#07101f] text-white">
      <section className="border-b border-white/10 bg-[#0a0f1e]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              Custodia Ops
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Founder dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300 md:text-base">
              Manage startups through the CMMC Level 1 sprint from lead intake to bid-ready status,
              then transition them into the ongoing managed compliance retainer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-white/30 hover:text-white"
            >
              Back to site
            </Link>
            <UserButton />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Active clients" value={String(clients.length)} />
            <MetricCard label="Bid-ready" value={String(stageCounts.find((entry) => entry.stage === "bid-ready")?.count ?? 0)} />
            <MetricCard label="On retainer" value={String(stageCounts.find((entry) => entry.stage === "retainer")?.count ?? 0)} />
            <MetricCard label="New waitlist leads" value={String(waitlist.length)} />
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Sprint pipeline</h2>
                <p className="mt-2 text-sm text-gray-300">
                  Move founders through the exact delivery path: intake, SAM.gov, SSP, controls,
                  evidence, bid readiness, then retainer.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {stageCounts.map(({ stage, count }) => (
                <div key={stage} className="rounded-2xl border border-white/10 bg-[#0e1730] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                    {stageLabels[stage]}
                  </div>
                  <div className="mt-3 text-3xl font-black">{count}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/5 text-gray-300">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-[#08101f]">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        No clients yet. Add your first sprint client using the intake form.
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{client.name}</div>
                          <div className="mt-1 text-xs text-gray-400">{client.email ?? "No email added"}</div>
                        </td>
                        <td className="px-4 py-4 text-gray-200">{client.company}</td>
                        <td className="px-4 py-4">
                          <form action={updateClientStageAction} className="flex items-center gap-2">
                            <input type="hidden" name="clientId" value={client.id} />
                            <select
                              name="sprintStage"
                              defaultValue={client.sprint_stage}
                              className="min-w-44 rounded-xl border border-white/10 bg-[#13203d] px-3 py-2 text-sm text-white outline-none"
                            >
                              {sprintStages.map((stage) => (
                                <option key={stage} value={stage}>
                                  {stageLabels[stage]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-gray-900 transition-colors hover:bg-amber-300"
                            >
                              Save
                            </button>
                          </form>
                        </td>
                        <td className="px-4 py-4 text-gray-300">{client.notes || "-"}</td>
                        <td className="px-4 py-4 text-gray-400">
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

        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white p-6 text-gray-900 shadow-2xl">
            <h2 className="text-2xl font-black">Add sprint client</h2>
            <p className="mt-2 text-sm text-gray-600">
              Add a startup as soon as they engage. This becomes the operating record for their sprint.
            </p>
            <form action={createClientAction} className="mt-6 space-y-4">
              <Field label="Founder name" name="name" placeholder="Jane Founder" required />
              <Field label="Company" name="company" placeholder="Acme Defense AI" required />
              <Field label="Email" name="email" type="email" placeholder="jane@acme.ai" />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700">Notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Current contract target, blockers, timelines, or special scope..."
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-amber-400"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-2xl bg-[#0a0f1e] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#101937]"
              >
                Create client record
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-2xl font-black">Latest waitlist leads</h2>
            <p className="mt-2 text-sm text-gray-300">
              Incoming landing-page demand captured from the bootcamp application form.
            </p>
            <div className="mt-6 space-y-3">
              {waitlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-gray-400">
                  No waitlist entries yet.
                </div>
              ) : (
                waitlist.map((lead) => (
                  <div key={lead.id} className="rounded-2xl border border-white/10 bg-[#0e1730] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{lead.name || "Unnamed lead"}</div>
                        <div className="mt-1 text-sm text-gray-300">{lead.company || "No company provided"}</div>
                        <div className="mt-1 text-xs text-gray-400">{lead.email}</div>
                      </div>
                      <div className="text-xs text-gray-400">{new Date(lead.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-3 text-4xl font-black text-white">{value}</div>
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
      <span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-amber-400"
      />
    </label>
  );
}
