import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility Statement | BidFedCMMC",
  description:
    "BidFedCMMC accessibility statement — commitment to WCAG 2.1 AA, contact for accommodations.",
};

export default function AccessibilityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Accessibility Statement</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Our commitment</h2>
          <p>
            Custodia, LLC is committed to making the BidFedCMMC platform and website
            accessible to people with disabilities. We strive to conform to the Web
            Content Accessibility Guidelines (WCAG) 2.1, Level AA, published by the World
            Wide Web Consortium (W3C), and we measure ourselves against the practices
            relevant to U.S. federal accessibility expectations including Section 508 of
            the Rehabilitation Act and the Americans with Disabilities Act (ADA) Title
            III.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">What we have done</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Semantic HTML structure with landmarks, headings, and labeled controls.</li>
            <li>Keyboard navigation supported across the platform.</li>
            <li>Color-contrast ratios reviewed against WCAG 2.1 AA targets.</li>
            <li>Form fields have visible labels and accessible error messages.</li>
            <li>Focus indicators are visible across interactive elements.</li>
            <li>Alternative text on meaningful images.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Known limitations</h2>
          <p>
            Some user-generated content (uploaded evidence files, PDFs, screenshots) may
            not meet WCAG 2.1 AA because it is supplied by the customer. We provide
            accessibility-friendly summaries where feasible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Request an accommodation</h2>
          <p>
            If you encounter an accessibility barrier or need an accommodation to use the
            Service, contact{" "}
            <a href="mailto:accessibility@bidfedcmmc.com" className="text-emerald-700 underline">
              accessibility@bidfedcmmc.com
            </a>
            . We will respond within five (5) business days and work with you to provide
            the information or function through an alternative accessible means.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Ongoing review</h2>
          <p>
            We review the accessibility of the Service at least annually and after any
            material design changes. We welcome feedback at the address above.
          </p>
        </section>
      </div>
    </main>
  );
}
