import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Custodia",
  description:
    "Custodia privacy policy — federal-grade data handling for CMMC-aligned compliance software, built and operated in the United States.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Privacy Policy</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 2, 2026 &middot; Custodia, Pittsburgh, Pennsylvania, USA
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Federal posture</h2>
          <p>
            Custodia (&ldquo;Custodia,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a
            U.S.-built, U.S.-operated cybersecurity compliance platform headquartered in
            Pittsburgh, Pennsylvania. Custodia software supports U.S. defense and federal
            contractors in meeting their obligations under the Federal Acquisition Regulation
            (FAR), the Defense Federal Acquisition Regulation Supplement (DFARS), and the
            Cybersecurity Maturity Model Certification (CMMC) program.
          </p>
          <p>
            This Privacy Policy describes how Custodia collects, uses, discloses, retains,
            and safeguards information of customers, prospective customers, and visitors to{" "}
            <a href="https://bidfedcmmc.com" className="text-emerald-700 underline">
              bidfedcmmc.com
            </a>{" "}
            and the Custodia platform (collectively, the &ldquo;Service&rdquo;).
          </p>
          <p>
            <strong>Regulatory frameworks we align to:</strong> NIST SP 800-171 Rev. 2,
            FAR 52.204-21, DFARS 252.204-7012, CMMC Level 1 (and selected Level 2 practices
            on the operator side), 32 CFR Part 170, and the Privacy Act of 1974, as
            applicable to a commercial service provider handling federal contractor data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Information we collect</h2>
          <p>We collect only the information needed to deliver the Service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account data:</strong> name, business email, company name, NAICS codes,
              UEI/CAGE if provided.
            </li>
            <li>
              <strong>Compliance content:</strong> control responses, evidence files,
              attestations, SPRS scoring data, and assessment artifacts that you upload or
              that Custodia generates on your behalf.
            </li>
            <li>
              <strong>Integration metadata (Microsoft 365 / Google Workspace):</strong> if
              you authorize an integration, we read user directory listings, audit-log
              metadata, and policy settings via read-only OAuth scopes. We do not read
              email content, calendar bodies, file contents, or personal communications.
            </li>
            <li>
              <strong>Telemetry:</strong> non-personally-identifying usage metrics, error
              logs, and security event data needed for product reliability and audit-log
              integrity.
            </li>
            <li>
              <strong>Billing data:</strong> processed by our PCI-DSS-compliant payment
              processor; Custodia does not store full payment-card numbers.
            </li>
          </ul>
          <p className="mt-2">
            <strong>Federal Contract Information (FCI) and Controlled Unclassified Information (CUI):</strong>{" "}
            Customers should not upload FCI marked for limited distribution or any CUI to
            the Service unless their subscription explicitly covers CUI handling. The
            standard Custodia platform is designed to support a customer&apos;s CMMC
            Level&nbsp;1 program (FCI scope) and is not authorized for storage of CUI.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. How we use information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide, operate, secure, and improve the Service.</li>
            <li>
              Generate compliance assessments, SPRS-style scores, evidence packages, policies,
              and audit artifacts.
            </li>
            <li>
              Send transactional and compliance-relevant communications (e.g., the weekly
              Compliance Pulse, evidence-freshness alerts, account notices).
            </li>
            <li>Provide customer support and respond to inquiries.</li>
            <li>
              Detect, investigate, and prevent fraud, abuse, security incidents, and
              violations of our Terms.
            </li>
            <li>Comply with U.S. federal, state, and local legal obligations.</li>
          </ul>
          <p className="mt-2">
            We do not sell personal information. We do not use customer compliance data to
            train third-party generative AI models.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Microsoft 365 and Google Workspace integrations</h2>
          <p>
            When you connect Microsoft 365 or Google Workspace, Custodia uses OAuth 2.0 to
            obtain a least-privilege, read-only token to your organization&apos;s tenant.
            Tokens are encrypted at rest with AES-256-GCM using a per-deployment key under
            our control.
          </p>
          <p>
            <strong>Use limitation:</strong> Custodia accesses only the directory, audit-log,
            and policy data necessary to produce evidence for the controls in your active
            CMMC Level 1 assessment. Custodia&apos;s use and transfer of information received
            from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-emerald-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p>
            You may revoke Custodia&apos;s integration access at any time from your
            organization&apos;s Microsoft Entra ID or Google Workspace admin console, or
            from the Custodia dashboard. Revocation purges the stored tokens within 24
            hours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Data residency and sub-processors</h2>
          <p>
            Customer data is stored on infrastructure located in the contiguous United
            States. Our primary sub-processors are:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Vercel Inc. (application hosting; United States)</li>
            <li>Neon, Inc. (managed Postgres database; United States)</li>
            <li>Vercel Blob (object storage; United States)</li>
            <li>Resend, Inc. (transactional email; United States)</li>
            <li>Anthropic PBC and OpenAI, L.L.C. (AI inference; United States, no training on customer data)</li>
            <li>Clerk, Inc. (authentication; United States)</li>
          </ul>
          <p>
            We will provide notice of changes to our sub-processor list to active customers
            at least 30 days before such changes take effect.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Security controls</h2>
          <p>
            Custodia maintains administrative, technical, and physical safeguards informed
            by NIST SP 800-171 Rev. 2 and the CMMC Level 1 practices applicable to a service
            provider. These include:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>TLS 1.2+ for data in transit; AES-256 for data at rest.</li>
            <li>HMAC-signed and hash-anchored audit artifacts to detect tampering.</li>
            <li>Role-based access control with the principle of least privilege.</li>
            <li>Multi-factor authentication for all administrative access.</li>
            <li>Continuous logging, monitoring, and incident-response procedures.</li>
            <li>Annual review of security controls and sub-processor posture.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Cyber-incident notification</h2>
          <p>
            In the event of a confirmed unauthorized disclosure of customer data, Custodia
            will notify affected customers without unreasonable delay and, in any event,
            within seventy-two (72) hours of confirmation, consistent with the spirit of
            DFARS 252.204-7012(c). The notification will describe the nature of the
            incident, the data involved (to the extent known), and the remediation steps
            taken.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">8. Data retention and deletion</h2>
          <p>
            Account and compliance content is retained for the term of your subscription
            plus 90 days after cancellation, after which it is purged. Audit-trail records
            (security and access logs) are retained for one (1) year to support our own
            compliance obligations. You may request earlier deletion of your account data
            by writing to{" "}
            <a href="mailto:support@custodia.dev" className="text-emerald-700 underline">
              support@custodia.dev
            </a>
            ; Custodia will complete the request within thirty (30) days unless retention
            is required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">9. Your rights</h2>
          <p>
            You may request access to, correction of, deletion of, or a portable copy of,
            personal information we hold about you. Requests should be sent to{" "}
            <a href="mailto:support@custodia.dev" className="text-emerald-700 underline">
              support@custodia.dev
            </a>
            . We will verify your identity before fulfilling a request and will respond
            within thirty (30) days.
          </p>
          <p>
            Where applicable, residents of California, Virginia, Colorado, Connecticut,
            Utah, and other U.S. states with comprehensive privacy laws have additional
            rights, including the right to opt out of profiling and the right to
            non-discrimination for exercising privacy rights. Custodia does not engage in
            cross-context behavioral advertising.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">10. Children</h2>
          <p>
            The Service is intended for business use by adults. We do not knowingly collect
            information from individuals under 18 years of age.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">11. Changes to this Policy</h2>
          <p>
            We will provide notice of material changes by email and in-product banner at
            least fourteen (14) days before the changes take effect. The &ldquo;Effective
            date&rdquo; above will be updated accordingly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
          <p>
            <strong>Custodia</strong>
            <br />
            Pittsburgh, Pennsylvania, United States
            <br />
            <a href="mailto:support@custodia.dev" className="text-emerald-700 underline">
              support@custodia.dev
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
