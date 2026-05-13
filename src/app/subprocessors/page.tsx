import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sub-processors | BidFedCMMC",
  description:
    "Sub-processors used by Custodia, LLC to deliver the platform. All processing is in the United States.",
};

export default function SubprocessorsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Sub-processors</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <p>
            Custodia, LLC uses the U.S.-based sub-processors listed below to operate the
            BidFedCMMC platform (the &ldquo;Service&rdquo;). All processing locations
            listed are in the contiguous United States. Each sub-processor is bound by a
            written agreement that obligates it to confidentiality and to security
            measures appropriate to the data it handles.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Current sub-processors</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 font-semibold text-slate-900">Sub-processor</th>
                <th className="py-2 pr-4 font-semibold text-slate-900">Purpose</th>
                <th className="py-2 font-semibold text-slate-900">Location</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Vercel Inc.</td>
                <td className="py-2 pr-4 align-top">Application hosting, edge runtime, blob object storage.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Neon Inc.</td>
                <td className="py-2 pr-4 align-top">Managed PostgreSQL database hosting.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Amazon Web Services, Inc.</td>
                <td className="py-2 pr-4 align-top">AWS Key Management Service for envelope encryption of customer data.</td>
                <td className="py-2 align-top">USA (us-east region)</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Clerk, Inc.</td>
                <td className="py-2 pr-4 align-top">User authentication, session management, MFA.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Stripe, Inc.</td>
                <td className="py-2 pr-4 align-top">Payment processing for subscriptions.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Resend, Inc.</td>
                <td className="py-2 pr-4 align-top">Transactional email delivery (account, billing, security notices).</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Anthropic, PBC</td>
                <td className="py-2 pr-4 align-top">AI inference for Charlie compliance assistant. Zero-retention API; not used for model training.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">OpenAI, L.L.C.</td>
                <td className="py-2 pr-4 align-top">AI inference for selected features. Zero-retention API; not used for model training.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 align-top">Functional Software, Inc. d/b/a Sentry</td>
                <td className="py-2 pr-4 align-top">Application error monitoring.</td>
                <td className="py-2 align-top">USA</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Changes and notice</h2>
          <p>
            We will post material additions or replacements to this list at least thirty
            (30) days before a new sub-processor begins processing customer data. To
            receive change notifications, email{" "}
            <a href="mailto:legal@bidfedcmmc.com" className="text-emerald-700 underline">
              legal@bidfedcmmc.com
            </a>{" "}
            with the subject line &ldquo;Subprocessor notifications.&rdquo;
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Related documents</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Link href="/privacy" className="text-emerald-700 underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/dpa" className="text-emerald-700 underline">
                Data Processing Addendum
              </Link>
            </li>
            <li>
              <Link href="/security" className="text-emerald-700 underline">
                Security overview
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
