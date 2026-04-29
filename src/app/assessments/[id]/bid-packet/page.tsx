import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
import { bidProfileCompleteness, loadBidProfile } from "@/lib/bid-profile";

export const dynamic = "force-dynamic";

export default async function BidPacketPage(
  props: PageProps<"/assessments/[id]/bid-packet">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const profile = await loadBidProfile(ctx.organization.id);
  const { score, missing } = bidProfileCompleteness(profile);

  const attested = ctx.assessment.status === "attested";
  const registrationOk = Boolean(
    ctx.organization.sam_uei && ctx.organization.cage_code,
  );

  const blockers: string[] = [];
  if (!registrationOk) {
    blockers.push("Federal registration (UEI + CAGE) not on file");
  }
  if (score < 50) {
    blockers.push(`Bid profile only ${score}/100 — fill in the missing fields`);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 5 of 7 · Bid-Ready Packet
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Review &amp; download
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Your CMMC posture is locked. Now finalize the firm-wide packet you&apos;ll send with proposals — your editable Bid-Ready Profile (capability statement, past performance, NAICS) merged with the locked compliance snapshot. One PDF every contracting officer wants.
        </p>
      </header>

      {blockers.length > 0 ? (
        <div className="mb-6 rounded-md border border-[#a06b1a] bg-[#fff7e8] p-4 text-sm text-[#5a3d0a]">
          <div className="font-semibold">
            Fix these before generating a polished packet:
          </div>
          <ul className="mt-2 list-disc pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {!registrationOk ? (
              <Link
                href={`/assessments/${id}/registration`}
                className="rounded-sm border border-[#a06b1a] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a3d0a] hover:bg-[#fff2d8]"
              >
                → Fix registration
              </Link>
            ) : null}
            <Link
              href="/profile/bid-ready"
              className="rounded-sm border border-[#a06b1a] bg-white px-3 py-1.5 text-xs font-semibold text-[#5a3d0a] hover:bg-[#fff2d8]"
            >
              → Edit bid profile
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2 rounded-md border border-[#cfe3d9] bg-white p-6">
          <h2 className="font-serif text-lg font-bold">What&apos;s in the packet</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <PacketRow
              label="Cover"
              value={`${ctx.organization.name} · UEI ${ctx.organization.sam_uei ?? "—"} · CAGE ${ctx.organization.cage_code ?? "—"}`}
              source="Organization record + bid profile"
              locked
            />
            <PacketRow
              label="Capability statement"
              value={
                profile.capability_statement.trim()
                  ? `${profile.capability_statement.trim().slice(0, 120)}${profile.capability_statement.length > 120 ? "…" : ""}`
                  : "Not yet written"
              }
              source="Bid profile (editable)"
            />
            <PacketRow
              label="Core competencies"
              value={
                profile.core_competencies.trim()
                  ? `${profile.core_competencies.split(/\r?\n/).filter(Boolean).length} bullet${profile.core_competencies.split(/\r?\n/).filter(Boolean).length === 1 ? "" : "s"}`
                  : "Not yet written"
              }
              source="Bid profile (editable)"
            />
            <PacketRow
              label="Set-aside certifications"
              value={
                profile.set_asides.length === 0
                  ? "None claimed"
                  : `${profile.set_asides.length} on file`
              }
              source="Bid profile (editable)"
            />
            <PacketRow
              label="CMMC L1 affirmation"
              value={
                attested
                  ? `Affirmed ${ctx.assessment.affirmed_at ? new Date(ctx.assessment.affirmed_at).toLocaleDateString() : ""} by ${ctx.assessment.affirmed_by_name ?? "—"}`
                  : "Pending — packet will render as draft"
              }
              source="Assessment record"
              locked
            />
            <PacketRow
              label="Past performance"
              value={`${profile.past_performance.length} entr${profile.past_performance.length === 1 ? "y" : "ies"}`}
              source="Bid profile (editable)"
            />
            <PacketRow
              label="Insurance & bonding"
              value={
                profile.insurance.carrier
                  ? `${profile.insurance.carrier}${profile.insurance.expiration_date ? ` · expires ${profile.insurance.expiration_date}` : ""}`
                  : "Not on file"
              }
              source="Bid profile (editable)"
            />
            <PacketRow
              label="Point of contact"
              value={
                profile.poc_name
                  ? `${profile.poc_name}${profile.poc_email ? ` · ${profile.poc_email}` : ""}`
                  : "Not on file"
              }
              source="Bid profile (editable)"
            />
          </ul>
        </section>

        <aside className="rounded-md border border-[#cfe3d9] bg-white p-6">
          <h2 className="font-serif text-lg font-bold">Profile readiness</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-serif text-4xl font-bold text-[#0e2a23]">
              {score}
            </span>
            <span className="text-sm text-[#456c5f]">/ 100</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-[#e3eee8]">
            <div
              className="h-full bg-[#2f8f6d]"
              style={{ width: `${score}%` }}
            />
          </div>
          {missing.length > 0 ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#456c5f]">
                Still missing
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs text-[#10231d]">
                {missing.slice(0, 5).map((m) => (
                  <li key={m}>{m}</li>
                ))}
                {missing.length > 5 ? (
                  <li className="text-[#456c5f]">
                    +{missing.length - 5} more
                  </li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-xs text-[#2f8f6d]">
              Every section has enough content for a clean packet.
            </p>
          )}
          <Link
            href="/profile/bid-ready"
            className="mt-5 block rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-center text-xs font-semibold text-[#10231d] hover:bg-[#f1f6f3]"
          >
            Edit bid profile →
          </Link>
        </aside>
      </div>

      <section className="mt-8 rounded-md border border-[#10231d] bg-[#10231d] p-6 text-white">
        <h2 className="font-serif text-lg font-bold text-white">
          Generate the packet
        </h2>
        <p className="mt-2 text-sm text-[#cfe3d9]">
          Opens a print-ready document in a new tab. Use your browser&apos;s
          Print → Save as PDF to lock in a snapshot. Re-generate anytime —
          edits to your master profile flow into the next packet automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`/api/assessments/${id}/bid-packet`}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-sm bg-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#0e2a23] hover:bg-white"
          >
            Open packet in new tab
          </a>
          <a
            href={`/api/assessments/${id}/bid-packet`}
            download
            className="rounded-sm border border-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] hover:bg-[#0e2a23]"
          >
            Download HTML
          </a>
        </div>
        <p className="mt-3 text-xs text-[#90b8aa]">
          Looking for the full compliance bundle (SSP + every evidence file as
          a ZIP)?{" "}
          <a
            href={`/api/assessments/${id}/bid-package`}
            className="underline"
          >
            Download the bid-package ZIP
          </a>
          .
        </p>
      </section>

      <section className="mt-6 rounded-md border border-[#cfe3d9] bg-[#f7fcf9] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold">
              Bidding on a specific opportunity?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#10231d]">
              Paste the SAM.gov notice or scope of work and we&apos;ll tailor
              your capability statement to match the agency&apos;s language —
              without touching your master profile. The best fit wins more
              bids; we make alignment one click away.
            </p>
          </div>
          <Link
            href={`/assessments/${id}/bid-packet/tailor`}
            className="flex-none rounded-sm bg-[#10231d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0e2a23]"
          >
            Tailor for opportunity →
          </Link>
        </div>
      </section>
    </main>
  );
}

function PacketRow({
  label,
  value,
  source,
  locked,
}: {
  label: string;
  value: string;
  source: string;
  locked?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-[#e3eee8] pb-3 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
          {label}
        </div>
        <div className="mt-1 truncate text-sm text-[#10231d]">{value}</div>
      </div>
      <div className="flex flex-none items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        {locked ? (
          <span className="rounded-sm bg-[#10231d] px-2 py-1 text-[#bdf2cf]">
            Locked
          </span>
        ) : (
          <span className="rounded-sm border border-[#cfe3d9] bg-white px-2 py-1 text-[#2f8f6d]">
            Editable
          </span>
        )}
        <span className="hidden text-[#456c5f] md:inline">{source}</span>
      </div>
    </li>
  );
}
