import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Processing Addendum | BidFedCMMC",
  description:
    "BidFedCMMC Data Processing Addendum overview — available on request for customers acting as a data controller.",
};

export default function DPAPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Data Processing Addendum</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <p>
            Custodia, LLC offers a Data Processing Addendum (&ldquo;DPA&rdquo;) for
            customers who, in the course of using the BidFedCMMC platform (the
            &ldquo;Service&rdquo;), process personal information of natural persons in a
            capacity that triggers controller / processor obligations under U.S. state
            comprehensive privacy laws (CCPA/CPRA, VCDPA, CPA, CTDPA, UCPA, TDPSA, OCPA,
            and similar laws). This page summarizes our DPA. The signed DPA controls.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Who needs a DPA</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Managed Service Providers (MSPs) running the Service on behalf of multiple end-customer organizations.</li>
            <li>Businesses subject to U.S. state privacy laws that require processor or service-provider terms with vendors.</li>
            <li>Government contractors with flow-down data-handling obligations from their prime contractor.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">What the DPA covers</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Roles: Customer as controller (or business); BidFedCMMC as processor (or service provider).</li>
            <li>Scope and purpose limited to delivering the Service.</li>
            <li>Categories of personal information processed.</li>
            <li>Confidentiality, security controls, and personnel obligations.</li>
            <li>Sub-processor authorization with prior notice (see{" "}
              <Link href="/subprocessors" className="text-emerald-700 underline">
                /subprocessors
              </Link>
              ).</li>
            <li>Assistance with data-subject rights requests.</li>
            <li>Breach notification within 72 hours of confirmation.</li>
            <li>Audit rights: BidFedCMMC will respond to reasonable written security questionnaires once per twelve-month period.</li>
            <li>Deletion or return of personal information at end of term.</li>
            <li>Liability and indemnification consistent with our{" "}
              <Link href="/terms" className="text-emerald-700 underline">
                Terms of Service
              </Link>
              .</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">No international transfer mechanism</h2>
          <p>
            The Service is offered only to U.S. legal entities and customer data is stored
            in the contiguous United States. We do not provide GDPR Standard Contractual
            Clauses, UK International Data Transfer Agreement, or comparable transfer
            mechanisms, because the Service is not designed to process data of non-U.S.
            data subjects.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">How to request the DPA</h2>
          <p>
            Email{" "}
            <a href="mailto:legal@bidfedcmmc.com" className="text-emerald-700 underline">
              legal@bidfedcmmc.com
            </a>{" "}
            with your legal entity name, the contracting individual&apos;s title, and any
            specific contractual flow-down language you need us to acknowledge. We will
            return a counter-signature within five (5) business days.
          </p>
        </section>
      </div>
    </main>
  );
}
