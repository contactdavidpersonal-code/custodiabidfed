import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";

export default async function DeliverablesPage(
  props: PageProps<"/assessments/[id]/deliverables">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const attested = ctx.assessment.status === "attested";

  if (!attested) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center rounded-sm bg-[#0e2a23] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]">
          Step 5 of 5 &bull; Locked
        </div>
        <h1 className="mt-6 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Deliverables unlock the moment you sign
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#5a7d70]">
          Once your senior official signs the affirmation, this page hands you
          three things: the System Security Plan (SSP), the SPRS affirmation
          memo, and a single bid-ready zip with every piece of evidence
          attached.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/assessments/${id}`}
            className="rounded-sm border border-[#cfe3d9] bg-white px-4 py-2.5 text-sm font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
          >
            Back to practices
          </Link>
          <Link
            href={`/assessments/${id}/sign`}
            className="rounded-sm bg-[#0e2a23] px-5 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Go sign &rarr;
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 5 of 5
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Bid-ready deliverables
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          You&apos;re signed and locked. File the affirmation in SPRS, keep the
          bid-ready package on hand for primes, and you&apos;re CMMC Level 1
          compliant for this cycle.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Bid-ready package"
          subtitle="SSP + affirmation + every evidence file, zipped"
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

      <section className="mt-10 rounded-md border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
        <h2 className="font-serif text-lg font-bold text-[#10231d]">
          What to do with these
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-[#10231d]">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
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
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
              2
            </span>
            <p>
              When a prime asks for proof, send them the Bid-ready package zip.
              It contains everything they need to satisfy FAR 52.204-21.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-sm bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
              3
            </span>
            <p>
              Re-affirm annually. Custodia auto-imports last year&apos;s
              evidence next cycle &mdash; you only re-confirm what changed.
            </p>
          </li>
        </ol>
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
    "group block rounded-md border p-5 transition-all";
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
