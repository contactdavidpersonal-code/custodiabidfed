import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { enforceStepOrder, getAssessmentForUser } from "@/lib/assessment";
import { getSql } from "@/lib/db";

async function fetchPublicVerifiedSlug(
  organizationId: string,
): Promise<string | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT verification_slug, slug, is_public
    FROM trust_pages
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
  `) as Array<{
    verification_slug: string | null;
    slug: string | null;
    is_public: boolean | null;
  }>;
  if (rows.length === 0) return null;
  return rows[0].verification_slug ?? rows[0].slug ?? null;
}

export default async function DeliverablesPage(
  props: PageProps<"/assessments/[id]/deliverables">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "attested");

  const attested = ctx.assessment.status === "attested";
  const verificationId = ctx.assessment.custodia_verification_id;
  const verifiedSlug = verificationId
    ? await fetchPublicVerifiedSlug(ctx.organization.id)
    : null;

  if (!attested) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center md:px-6 md:py-16">
        <div className="inline-flex items-center justify-center  bg-[#0e2a23] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]">
          Step 7 of 8 &bull; Locked
        </div>
        <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Deliverables unlock the moment you sign
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#5a7d70]">
          Once your senior official signs the affirmation, this page hands you
          three things: the System Security Plan (SSP), the SPRS affirmation
          memo, and a single sealed bid-ready zip with every piece of evidence,
          your full audit log, and a tamper-evident integrity manifest — your
          six-year retention record.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/assessments/${id}`}
            className=" border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
          >
            Back to practices
          </Link>
          <Link
            href={`/assessments/${id}/sign`}
            className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Go sign &rarr;
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 7 of 8
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          You&apos;re officially CMMC Level 1 compliant.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Affirmation locked. Here&apos;s everything you need to bid with confidence — file with SPRS, keep the package on hand for primes, and head to step 7 to find your first contract.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Sealed L1 record (.zip)"
          subtitle="SSP + affirmation + evidence + audit log + signature manifest. Custom-built for your CAGE. Retain 6 years (FAR 4.703)."
          href={`/api/assessments/${id}/bid-package`}
          primary
        />
        <Card
          title="System Security Plan"
          subtitle="Stand-alone SSP for prime requests"
          href={`/assessments/${id}/ssp`}
        />
        <Card
          title="Affirmation memo"
          subtitle="Senior official signature page"
          href={`/assessments/${id}/affirmation`}
        />
      </div>

      {/* Custodia Verification ID — public, prime-shareable proof. Only
          materializes once the user records their SPRS Status Date, so we
          show a "what this becomes" teaser before that and a live card
          (with copy-paste + public URL) after. */}
      <section className="mt-10 border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              Share with primes
            </p>
            <h2 className="mt-2 font-serif text-lg font-bold text-[#10231d]">
              Your Custodia Verification ID
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5a7d70]">
              A unique, public identifier a prime can paste into{" "}
              <code className="rounded bg-[#f1f6f3] px-1 py-0.5 text-[12px] text-[#0c2219]">
                bidfedcmmc.com/verified/&hellip;
              </code>{" "}
              to confirm your CMMC L1 self-assessment is on file, current,
              and tamper-evident. Decoupled from CAGE / UEI on purpose &mdash;
              it&apos;s safe to email, drop in a proposal, or embed as a badge.
            </p>
          </div>
          {verificationId ? (
            <div className="flex-none border border-[#0e2a23] bg-[#0e2a23] p-4 text-[#bdf2cf]">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]/80">
                Verification ID
              </div>
              <div className="mt-1 font-mono text-base font-bold tracking-wider text-white">
                {verificationId}
              </div>
            </div>
          ) : (
            <div className="flex-none border border-dashed border-[#cfe3d9] bg-[#f1f6f3] p-4 text-[#5a7d70]">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em]">
                Verification ID
              </div>
              <div className="mt-1 font-mono text-base font-bold tracking-wider">
                CUST-V-&middot;&middot;&middot;&middot;&middot;&middot;
              </div>
              <div className="mt-1 text-[11px]">
                Issued after you record your SPRS Status Date
              </div>
            </div>
          )}
        </div>

        {verificationId && verifiedSlug ? (
          <div className="mt-5 border-t border-[#cfe3d9] pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
              Public verification URL
            </p>
            <div className="mt-2 break-all border border-[#cfe3d9] bg-[#f1f6f3] p-3 font-mono text-xs text-[#0c2219]">
              https://bidfedcmmc.com/verified/{verifiedSlug}
            </div>
            <p className="mt-3 text-xs text-[#5a7d70]">
              Anyone can hit this URL &mdash; no Custodia account required. It
              shows your org, CMMC L1 Self status, affirmation date, evidence
              freshness, and the tamper-evident attestation hash. The same page
              backs the SVG / HTML badge you can embed on your site.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`/verified/${verifiedSlug}`}
                target="_blank"
                rel="noopener"
                className="border border-[#cfe3d9] bg-white px-3 py-2 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
              >
                Open my public page &rarr;
              </a>
              <Link
                href={`/assessments/${id}/verified`}
                className="border border-[#cfe3d9] bg-white px-3 py-2 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
              >
                Badge settings
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-6  border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
        <h2 className="font-serif text-lg font-bold text-[#10231d]">
          What to do with these
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-[#10231d]">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center  bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
              1
            </span>
            <p>
              Log into{" "}
              <a
                href="https://www.sprs.csd.disa.mil/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-bold text-[#0e2a23] underline decoration-[#2f8f6d] underline-offset-4"
              >
                SPRS
              </a>{" "}
              and post your affirmation against your CAGE code.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center  bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
              2
            </span>
            <p>
              When a prime asks for proof, send them the Sealed L1 record zip.
              It contains everything they need to satisfy FAR 52.204-21 — plus
              the audit log and SHA-256 integrity manifest a sharper prime
              (or a DCMA auditor years later) will ask for.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center  bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
              3
            </span>
            <p>
              Archive a copy of this zip for at least six years after final
              payment on any contract that relied on this affirmation (FAR 4.703).
              <code className="ml-1 rounded bg-[#f1f6f3] px-1 py-0.5 text-[11px] text-[#0c2219]">MANIFEST.json</code>{" "}
              lets anyone verify the archive hasn&apos;t been altered — no
              Custodia account required.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center  bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
              4
            </span>
            <p>
              Re-affirm annually. Custodia auto-imports last year&apos;s
              evidence next cycle &mdash; you only re-confirm what changed.
            </p>
          </li>
        </ol>
        <div className="mt-5 border-t border-[#cfe3d9] pt-4 text-xs text-[#5a7d70]">
          Need to show a prime <em>when</em> something happened?{" "}
          <Link
            href={`/assessments/${id}/activity`}
            className="font-bold text-[#0c4a3a] underline decoration-[#bdf2cf] decoration-2 underline-offset-2 hover:text-[#0e2a23]"
          >
            Open the activity log &rarr;
          </Link>{" "}
          &mdash; every signature, evidence upload, SPRS filing, and scope
          change with timestamps. Same data sealed in the ZIP above.
        </div>
      </section>

      {/* Final hand-off to step 7 — the whole point of this platform. */}
      <section className="mt-6 overflow-hidden  border border-[#0e2a23] bg-gradient-to-br from-[#0e2a23] via-[#10342a] to-[#0e2a23] p-6 text-white shadow-[0_18px_44px_rgba(14,48,37,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]">
              Step 8 of 8 · Final step
            </p>
            <h2 className="mt-1 font-serif text-xl font-bold leading-tight md:text-2xl">
              You&apos;re bid-ready. Now go win the contract.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#cfe3d9]">
              Charlie (your vCO) sources federal opportunities from SAM.gov matched to your NAICS, set-asides, and capabilities. One click tailors the packet you just downloaded to that exact opportunity.
            </p>
          </div>
          <Link
            href="/opportunities"
            className=" bg-[#bdf2cf] px-5 py-2.5 text-sm font-bold tracking-tight text-[#0c2219] transition-colors hover:bg-[#a8e6c0]"
          >
            Find &amp; submit bids &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  subtitle,
  href,
  primary,
}: {
  title: string;
  subtitle: string;
  href: string;
  primary?: boolean;
}) {
  const base =
    "group block  border p-5 transition-all";
  const tone = primary
    ? "border-[#0e2a23] bg-[#0e2a23] text-white shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.18)] hover:bg-[#10342a]"
    : "border-[#cfe3d9] bg-white text-[#10231d] shadow-[0_2px_0_rgba(14,48,37,0.04)] hover:border-[#2f8f6d] hover:shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.10)]";
  return (
    <a href={href} className={`${base} ${tone}`}>
      <div
        className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
          primary ? "text-[#bdf2cf]" : "text-[#2f8f6d]"
        }`}
      >
        Download
      </div>
      <h3 className="mt-2 font-serif text-lg font-bold">{title}</h3>
      <p
        className={`mt-1 text-xs leading-relaxed ${
          primary ? "text-[#cfe3d9]" : "text-[#5a7d70]"
        }`}
      >
        {subtitle}
      </p>
      <div
        className={`mt-4 text-sm font-bold opacity-80 transition-opacity group-hover:opacity-100`}
      >
        Open &rarr;
      </div>
    </a>
  );
}
