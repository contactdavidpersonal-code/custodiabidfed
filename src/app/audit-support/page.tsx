import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Audit Support, included | Custodia",
  description:
    "If a prime asks for backup, or a DoD assessor knocks, your Custodia compliance officer prepares the package and walks the conversation with you. No extra invoice.",
};

export default function AuditSupportPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            &larr; Back to Custodia
          </Link>
        </div>

        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Included with every plan
        </div>
        <h1 className="mb-4 font-serif text-4xl text-slate-900">
          Audit Support, in your corner.
        </h1>
        <p className="mb-8 text-lg text-slate-700">
          A prime asking for your SPRS package. A DoD assessor reaching out.
          A government contract officer asking you to prove access control on
          a Friday afternoon. That is when most small companies quietly
          panic. Custodia customers don&apos;t.
        </p>

        <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-2xl text-slate-900">
            What&apos;s included
          </h2>
          <ul className="space-y-3 text-slate-700">
            <li className="flex gap-3">
              <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="text-slate-900">Same-day evidence pack.</strong>{" "}
                A signed, hash-anchored ZIP with your annual self-assessment,
                policies, and per-control evidence — re-generated on demand
                in minutes.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="text-slate-900">Officer-led prep call.</strong>{" "}
                A Carnegie Mellon-trained Custodia officer walks you through
                the assessor&apos;s likely questions before you take the
                meeting.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="text-slate-900">Written response support.</strong>{" "}
                When primes send DD-2345-style questionnaires or
                cybersecurity supplements, we draft the response.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="text-slate-900">Continuous re-affirmation.</strong>{" "}
                Charlie watches your environment year-round. If MFA gets
                turned off or someone retires a laptop without a wipe log,
                you hear about it before an assessor does.
              </span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 font-serif text-2xl text-slate-900">
            What&apos;s not included
          </h2>
          <p className="mb-3 text-slate-700">
            We are honest about scope so you know exactly what you&apos;re
            buying:
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              &middot; Legal representation in a False Claims Act matter — we
              loop in counsel of your choosing and prep the technical record.
            </li>
            <li>
              &middot; CMMC Level 2 / DFARS 252.204-7012 / FedRAMP — those are
              separate, officer-led engagements (we sell them; they are not
              the $249 plan).
            </li>
            <li>
              &middot; Onsite assessment travel — virtual is included; onsite
              is invoiced at cost only when you ask for it.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-900 p-8 text-center text-white shadow-sm">
          <h2 className="mb-2 font-serif text-2xl">
            All of this is in the $249 plan.
          </h2>
          <p className="mb-6 text-slate-300">
            One flat price. No add-ons. No tier upsells when an assessor
            knocks. Cancel any time.
          </p>
          <Link
            href="/pricing"
            className="inline-flex rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            See pricing
          </Link>
        </section>
      </div>
    </main>
  );
}
