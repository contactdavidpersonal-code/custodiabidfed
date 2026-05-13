import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Notice | BidFedCMMC",
  description:
    "Cookies and similar technologies used by the BidFedCMMC platform — strictly-necessary only, no third-party advertising.",
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Cookie Notice</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <p>
            This Cookie Notice explains the cookies and similar technologies the
            BidFedCMMC platform uses. It supplements our{" "}
            <Link href="/privacy" className="text-emerald-700 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">What we use</h2>
          <p>
            We use only <strong>strictly-necessary, first-party</strong> cookies and
            similar local-storage entries. We do <strong>not</strong> set third-party
            advertising cookies, cross-site tracking pixels, social-media trackers, or
            behavioral-profiling identifiers.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 font-semibold text-slate-900">Name / pattern</th>
                <th className="py-2 pr-4 font-semibold text-slate-900">Purpose</th>
                <th className="py-2 font-semibold text-slate-900">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top"><code>__session</code></td>
                <td className="py-2 pr-4 align-top">Authentication session cookie set by Clerk, our identity provider. Required to sign in.</td>
                <td className="py-2 align-top">Session</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top"><code>__client_uat</code> / <code>__clerk_*</code></td>
                <td className="py-2 pr-4 align-top">Clerk session-state cookies (user authentication, CSRF protection).</td>
                <td className="py-2 align-top">Up to 1 year</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top"><code>__Host-next-action</code> / <code>__next-router-state</code></td>
                <td className="py-2 pr-4 align-top">Next.js framework cookies for routing and server-action validation.</td>
                <td className="py-2 align-top">Session</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">localStorage: <code>custodia.publicCharlie.v1</code></td>
                <td className="py-2 pr-4 align-top">Stores the in-page transcript of the public Charlie helper so your conversation persists on refresh. Local to your browser only.</td>
                <td className="py-2 align-top">Until cleared</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Analytics</h2>
          <p>
            We use minimal first-party server-side telemetry (page views, error events) to
            run the Service reliably. We do not load third-party analytics scripts that
            set persistent cross-site identifiers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Your choices</h2>
          <p>
            Because we only use cookies that are strictly necessary to deliver the
            Service, applicable U.S. state privacy laws (CCPA/CPRA, VCDPA, CPA, CTDPA,
            UCPA, TDPSA, OCPA) do not require a separate consent banner. Disabling
            essential cookies in your browser will prevent the Service from functioning
            (you will not be able to sign in).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about cookies?{" "}
            <a href="mailto:privacy@bidfedcmmc.com" className="text-emerald-700 underline">
              privacy@bidfedcmmc.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
