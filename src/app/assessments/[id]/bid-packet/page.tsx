import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { enforceStepOrder, getAssessmentForUser } from "@/lib/assessment";
import {
  bidProfileCompleteness,
  setAsideLabels,
  type SetAside,
} from "@/lib/bid-profile";
import { loadBidProfile } from "@/lib/bid-profile-server";
import { PrintButton } from "../PrintButton";
import { SprsFilingPromptCard, SprsFilingReceiptCard } from "../SprsFilingPrompt";

export const dynamic = "force-dynamic";

export default async function BidPacketPage(
  props: PageProps<"/assessments/[id]/bid-packet">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "attested");

  const sp = (await props.searchParams) as Record<string, string | string[] | undefined>;
  const justSigned = sp?.signed === "1";

  const profile = await loadBidProfile(ctx.organization.id);
  const { score, missing } = bidProfileCompleteness(profile);

  const org = ctx.organization;
  const a = ctx.assessment;
  const attested = a.status === "attested";
  const sprsFiled = Boolean(a.sprs_filed_at);
  const registrationOk = Boolean(org.sam_uei && org.cage_code);

  const generatedDate = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const affirmDate = a.affirmed_at
    ? new Date(a.affirmed_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const competencies = profile.core_competencies
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blockers: string[] = [];
  if (!registrationOk) {
    blockers.push("Federal registration (UEI + CAGE) not on file");
  }
  if (score < 50) {
    blockers.push(`Bid profile only ${score}/100 — fill in the missing fields`);
  }
  if (!attested) {
    blockers.push(
      "Sign your CMMC Level 1 affirmation (step 5) — the packet bundles your locked compliance snapshot",
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/assessments/${id}`}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          &larr; Back to overview
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton label="Print / save as PDF" />
        </div>
      </div>

      {justSigned ? (
        <div className="mb-6 border border-emerald-300 bg-emerald-50 p-5 print:hidden">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">
            Affirmation locked
          </div>
          <h2 className="mt-1 font-serif text-xl font-bold text-emerald-950">
            Your bid-ready packet is unlocked.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            Review the snapshot below, then download the packet to send with
            proposals. After you file in SPRS,{" "}
            <Link
              href={`/assessments/${id}`}
              className="underline underline-offset-2"
            >
              come back to the overview
            </Link>{" "}
            and paste the SPRS confirmation number to mark your filing complete.
          </p>
        </div>
      ) : null}

      {attested && !sprsFiled ? (
        <div className="mb-8 print:hidden">
          <SprsFilingPromptCard
            assessmentId={id}
            fiscalYear={a.fiscal_year}
          />
        </div>
      ) : null}

      {attested && sprsFiled && a.sprs_filed_at && a.sprs_confirmation_number ? (
        <div className="mb-8 print:hidden">
          <SprsFilingReceiptCard
            assessmentId={id}
            fiscalYear={a.fiscal_year}
            sprsFiledAt={a.sprs_filed_at}
            sprsConfirmationNumber={a.sprs_confirmation_number}
          />
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="mb-6 border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 print:hidden">
          <div className="font-semibold uppercase tracking-wide text-amber-800">
            Fix these before generating a polished packet
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
                className="border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                → Fix registration
              </Link>
            ) : null}
            {!attested ? (
              <Link
                href={`/assessments/${id}/sign`}
                className="border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                → Go sign &amp; affirm
              </Link>
            ) : null}
            <Link
              href="/profile/bid-ready"
              className="border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              → Edit bid profile
            </Link>
          </div>
        </div>
      ) : null}

      <article className="print-document border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="mb-10 border-b border-slate-200 pb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Bid-Ready Packet
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {org.name}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Snapshot of the proposal evidence you&rsquo;ll attach to federal
            solicitations — capability statement, past performance,
            certifications, and the locked CMMC Level 1 affirmation.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
            <Meta label="SAM UEI" value={org.sam_uei ?? "[Not provided]"} />
            <Meta label="CAGE code" value={org.cage_code ?? "[Not provided]"} />
            <Meta
              label="Entity type"
              value={org.entity_type ?? "—"}
            />
            <Meta
              label="Compliance status"
              value={attested ? "CMMC L1 — Final (Self)" : "Draft"}
            />
            <Meta
              label="Affirmation date"
              value={affirmDate ?? "—"}
            />
            <Meta label="Packet generated" value={generatedDate} />
          </div>
        </header>

        <Section title="1. Capability statement">
          {profile.capability_statement.trim() ? (
            <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
              {profile.capability_statement.trim()}
            </p>
          ) : (
            <Empty>Add a capability statement on the bid profile.</Empty>
          )}
        </Section>

        <Section title="2. Differentiators">
          {profile.differentiators.trim() ? (
            <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
              {profile.differentiators.trim()}
            </p>
          ) : (
            <Empty>
              Tell COs what makes you the right pick — written once, reused
              forever.
            </Empty>
          )}
        </Section>

        <Section title="3. Core competencies">
          {competencies.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-slate-800">
              {competencies.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <Empty>
              Add one competency per line on the bid profile (NAICS-style
              capabilities).
            </Empty>
          )}
        </Section>

        <Section title="4. Set-aside certifications">
          {profile.set_asides.length > 0 ? (
            <ul className="grid gap-2 text-slate-800 md:grid-cols-2">
              {profile.set_asides.map((s: SetAside) => (
                <li
                  key={s}
                  className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  {setAsideLabels[s]}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No socio-economic set-asides claimed.</Empty>
          )}
        </Section>

        <Section title="5. Past performance">
          {profile.past_performance.length > 0 ? (
            <div className="space-y-4">
              {profile.past_performance.map((p, i) => (
                <div
                  key={p.id || i}
                  className="border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold text-slate-900">
                      {p.agency || "[Customer agency]"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.contract_no ? `Contract ${p.contract_no}` : ""}
                      {p.contract_no && p.naics ? " · " : ""}
                      {p.naics ? `NAICS ${p.naics}` : ""}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {p.period_start || "—"} → {p.period_end || "—"}
                    {p.value_usd ? ` · $${p.value_usd}` : ""}
                  </div>
                  {p.scope ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                      {p.scope}
                    </p>
                  ) : null}
                  {p.customer_name || p.customer_email || p.customer_phone ? (
                    <div className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold">Customer reference:</span>{" "}
                      {[p.customer_name, p.customer_email, p.customer_phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              Add at least one past performance reference. COs always look here
              first.
            </Empty>
          )}
        </Section>

        <Section title="6. Insurance &amp; bonding">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Insurance carrier
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {profile.insurance.carrier || "—"}
              </div>
              {profile.insurance.policy_number ? (
                <div className="mt-1 text-xs text-slate-600">
                  Policy {profile.insurance.policy_number}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-slate-600">
                {profile.insurance.general_liability_limit
                  ? `GL: ${profile.insurance.general_liability_limit}`
                  : null}
                {profile.insurance.general_liability_limit &&
                profile.insurance.professional_liability_limit
                  ? " · "
                  : ""}
                {profile.insurance.professional_liability_limit
                  ? `Prof: ${profile.insurance.professional_liability_limit}`
                  : null}
              </div>
              {profile.insurance.expiration_date ? (
                <div className="mt-1 text-xs text-slate-600">
                  Expires {profile.insurance.expiration_date}
                </div>
              ) : null}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Bonding
              </div>
              <div className="mt-1 text-sm text-slate-900">
                {profile.bonding.bonding_company || "—"}
              </div>
              {profile.bonding.bonding_capacity_usd ? (
                <div className="mt-1 text-xs text-slate-600">
                  Capacity {profile.bonding.bonding_capacity_usd}
                </div>
              ) : null}
            </div>
          </div>
        </Section>

        <Section title="7. Point of contact">
          {profile.poc_name || profile.poc_email ? (
            <div className="text-sm text-slate-800">
              <div className="font-semibold">
                {profile.poc_name || "—"}
                {profile.poc_title ? `, ${profile.poc_title}` : ""}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {[profile.poc_email, profile.poc_phone, profile.website]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          ) : (
            <Empty>Set a primary POC on the bid profile.</Empty>
          )}
        </Section>

        <Section title="8. Locked compliance snapshot">
          <div className="border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-baseline justify-between">
              <div className="font-semibold text-slate-900">
                CMMC Level 1 — Self-Assessment
              </div>
              <div className="text-xs uppercase tracking-wider text-emerald-800">
                {attested ? "Affirmed" : "Draft"}
              </div>
            </div>
            <div className="mt-2 grid gap-3 text-xs text-slate-700 md:grid-cols-2">
              <div>
                <span className="font-semibold text-slate-500">Affirming official:</span>{" "}
                {a.affirmed_by_name || "—"}
                {a.affirmed_by_title ? `, ${a.affirmed_by_title}` : ""}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Affirmed on:</span>{" "}
                {affirmDate ?? "—"}
              </div>
              <div className="md:col-span-2">
                <span className="font-semibold text-slate-500">Scope:</span>{" "}
                <span className="whitespace-pre-wrap">
                  {org.scoped_systems ?? "—"}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs print:hidden">
              <Link
                href={`/assessments/${id}/ssp`}
                className="border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Review SSP →
              </Link>
              <Link
                href={`/assessments/${id}/affirmation`}
                className="border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Review affirmation memo →
              </Link>
            </div>
          </div>
        </Section>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
          Generated by Custodia on {generatedDate} for {org.name}. The
          compliance snapshot is cryptographically sealed; editable bid-profile
          fields can be refreshed any time and re-snapshotted into the next
          packet.
        </footer>
      </article>

      <section className="mt-8 border border-[#10231d] bg-[#10231d] p-6 text-white print:hidden">
        <h2 className="font-serif text-lg font-bold text-white">
          Download the packet
        </h2>
        <p className="mt-2 text-sm text-[#cfe3d9]">
          The Bid-ready package <code className="bg-black/30 px-1">.zip</code>{" "}
          bundles this packet, your SSP, your signed affirmation memo, and
          every evidence artifact — exactly what a prime or CO asks for.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`/api/assessments/${id}/bid-package`}
            className="bg-amber-400 px-5 py-2.5 text-sm font-bold text-[#0e2a23] hover:bg-amber-300"
          >
            Download bid-ready package (.zip)
          </a>
          <a
            href={`/api/assessments/${id}/bid-packet`}
            target="_blank"
            rel="noreferrer noopener"
            className="border border-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] hover:bg-[#0e2a23]"
          >
            Open packet HTML in new tab
          </a>
          <a
            href={`/api/assessments/${id}/bid-packet`}
            download
            className="border border-[#bdf2cf] px-5 py-2.5 text-sm font-bold text-[#bdf2cf] hover:bg-[#0e2a23]"
          >
            Download packet HTML
          </a>
        </div>
      </section>

      <section className="mt-6 border border-[#cfe3d9] bg-[#f7fcf9] p-6 print:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-[#10231d]">
              Bidding on a specific opportunity?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#10231d]">
              Paste a SAM.gov notice or scope of work and Custodia tailors your
              capability statement to the agency&rsquo;s language — without
              touching your master profile.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="text-[#456c5f]">
                Profile readiness:{" "}
                <span className="font-bold text-[#10231d]">{score}/100</span>
              </span>
              {missing.length > 0 ? (
                <Link
                  href="/profile/bid-ready"
                  className="font-semibold text-[#2f8f6d] underline-offset-2 hover:underline"
                >
                  Fill in {missing.length} missing field
                  {missing.length === 1 ? "" : "s"} →
                </Link>
              ) : null}
            </div>
          </div>
          <Link
            href={`/assessments/${id}/bid-packet/tailor`}
            className="flex-none bg-[#10231d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0e2a23]"
          >
            Tailor for opportunity →
          </Link>
        </div>
      </section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed border-slate-300 bg-slate-50 p-3 text-xs italic text-slate-500">
      {children}
    </p>
  );
}
