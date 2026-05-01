import type { Metadata } from "next";
import Link from "next/link";
import { CHARLIE_BIO } from "@/lib/ai/charlie";

export const metadata: Metadata = {
  title: "Meet Charlie | Custodia",
  description:
    "Charlie is your virtual Compliance Officer — Carnegie Mellon-trained, plain-spoken, and built to walk you through CMMC Level 1 in a week.",
};

export default function MeetCharliePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            &larr; Back to Custodia
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-[280px_1fr] md:items-start">
          <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <div className="text-7xl font-bold text-slate-900">C</div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Charlie
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {CHARLIE_BIO.title}
            </div>
            <h1 className="mb-4 font-serif text-4xl text-slate-900">
              Meet {CHARLIE_BIO.name}
            </h1>
            <p className="mb-4 text-lg text-slate-700">
              &ldquo;{CHARLIE_BIO.intro}&rdquo;
            </p>
            <p className="text-slate-600">
              Charlie is the Custodia virtual Compliance Officer (vCO) — the
              voice you talk to when you need to get bid-ready, when an
              evidence file looks fishy, and when something in your environment
              quietly drifts out of compliance at 2am on a Tuesday.
            </p>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 font-serif text-2xl text-slate-900">
            How Charlie was built
          </h2>
          <ul className="space-y-3">
            {CHARLIE_BIO.credentials.map((c) => (
              <li
                key={c}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                <span className="text-slate-700">{c}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-600">
            Custodia&apos;s human compliance officers — trained at Carnegie
            Mellon&apos;s Information Networking Institute — sit behind every
            Charlie answer. When a question crosses into legal-advice
            territory or your scope outgrows Level 1, a human picks it up.
            That is built in. There is no upsell.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="mb-4 font-serif text-2xl text-slate-900">
            What Charlie won&apos;t do
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              <strong className="block text-slate-900">
                Pretend it&apos;s a lawyer.
              </strong>
              Affirmations carry False Claims Act exposure. Charlie flags it
              and sends you to counsel.
            </li>
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              <strong className="block text-slate-900">
                Sign off on weak evidence.
              </strong>
              Charlie blocks attestation when any of the 17 practices are
              still partial or unclear. No exceptions.
            </li>
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              <strong className="block text-slate-900">
                Drift into Level 2 or DFARS.
              </strong>
              Charlie is scoped to CMMC L1 — and tells you when an officer
              should take over.
            </li>
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              <strong className="block text-slate-900">
                Make up citations.
              </strong>
              Every regulatory quote pulls verbatim from FAR 52.204-21,
              32 CFR § 170, or NIST SP 800-171 r2.
            </li>
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-900 p-8 text-center text-white shadow-sm">
          <h2 className="mb-2 font-serif text-2xl">Try Charlie free for 14 days.</h2>
          <p className="mb-6 text-slate-300">
            Federal bid-ready in 7 days. $249/month, flat. Cancel any time.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            Start my free trial
          </Link>
          <p className="mt-4 text-xs text-slate-400">
            No credit card surprises. Tell us about your business and Charlie
            takes it from there.
          </p>
        </section>
      </div>
    </main>
  );
}
