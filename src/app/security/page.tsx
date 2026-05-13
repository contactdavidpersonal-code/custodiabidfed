import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security | BidFedCMMC",
  description:
    "How Custodia, LLC secures customer data — NIST SP 800-171 Rev. 2 aligned, AES-256-GCM at rest, TLS 1.2+ in transit, AWS KMS envelope encryption.",
};

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Security at BidFedCMMC</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <p>
            Custodia, LLC builds and operates the BidFedCMMC platform to a standard
            consistent with NIST Special Publication 800-171 Rev. 2 (the controls relevant
            to CMMC Level 1) and the cybersecurity practices we recommend to our own
            customers. This page summarizes the controls in place.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Data protection</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>At rest.</strong> Customer data is encrypted at rest with AES-256-GCM. Sensitive field-level data is wrapped under AWS Key Management Service (KMS) using envelope encryption with HKDF-derived per-tenant data-encryption keys.</li>
            <li><strong>In transit.</strong> All connections use TLS 1.2 or higher. Strict transport security (HSTS) is enabled at the edge.</li>
            <li><strong>Key management.</strong> The customer-data Key Encryption Key (KEK) lives in AWS KMS in the United States. Access is role-scoped; key rotation is enabled.</li>
            <li><strong>Data residency.</strong> Customer data is stored and processed in the contiguous United States.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Identity and access</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Customer authentication via Clerk, with optional multi-factor authentication.</li>
            <li>Internal administrative access requires MFA and is role-based and least-privilege.</li>
            <li>Production access is audit-logged and reviewed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Application security</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tenant isolation enforced at the data-access layer.</li>
            <li>CSRF protection on state-changing routes; strict same-site session cookies.</li>
            <li>Server-side input validation and output encoding.</li>
            <li>Dependency vulnerability scanning on every build; high/critical advisories triaged within seven (7) days.</li>
            <li>Pre-merge code review; production deploys are change-controlled.</li>
            <li>Application error monitoring with PII scrubbing.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Logging and monitoring</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Authentication and admin actions are logged with timestamps and actor identifiers.</li>
            <li>Audit logs are retained for at least one (1) year.</li>
            <li>Anomalous activity (impossible-travel sign-in, mass deletion) generates alerts.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Incident response</h2>
          <p>
            We maintain a written incident response procedure. On confirmation of an
            unauthorized acquisition of or access to customer data, we will notify
            affected customers without unreasonable delay and, in any event, within
            seventy-two (72) hours of confirmation, consistent with DFARS 252.204-7012(c)
            and the Pennsylvania Breach of Personal Information Notification Act (73 P.S.
            &sect; 2301 et seq.). We will provide reasonable assistance to the customer
            in fulfilling its onward notification obligations to DoD or other contracting
            agencies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Backup and continuity</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Database point-in-time recovery is enabled at the managed database provider.</li>
            <li>Critical configuration is in version control; infrastructure is reproducible.</li>
            <li>Annual review of the business-continuity and disaster-recovery posture.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Sub-processors</h2>
          <p>
            All sub-processors are U.S. entities operating in the United States. See{" "}
            <Link href="/subprocessors" className="text-emerald-700 underline">
              /subprocessors
            </Link>{" "}
            for the current list.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Coordinated vulnerability disclosure</h2>
          <p>
            Security researchers may report suspected vulnerabilities in good faith to{" "}
            <a href="mailto:security@bidfedcmmc.com" className="text-emerald-700 underline">
              security@bidfedcmmc.com
            </a>{" "}
            or via{" "}
            <a href="/.well-known/security.txt" className="text-emerald-700 underline">
              /.well-known/security.txt
            </a>
            . We commit to acknowledging reports within two (2) business days and to not
            pursue legal action against researchers who:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access only their own test account or data they own.</li>
            <li>Do not exfiltrate, modify, or destroy customer data.</li>
            <li>Do not perform denial-of-service or social-engineering attacks.</li>
            <li>Give us a reasonable opportunity to remediate before public disclosure.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Customer responsibilities</h2>
          <p>
            Security is shared. Customers are responsible for managing their own user
            roster, enabling MFA where available, classifying the data they upload (in
            particular not uploading prohibited data &mdash; see{" "}
            <Link href="/acceptable-use" className="text-emerald-700 underline">
              Acceptable Use Policy
            </Link>
            ), and configuring third-party integrations consistent with their own
            policies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Security questions and questionnaires:{" "}
            <a href="mailto:security@bidfedcmmc.com" className="text-emerald-700 underline">
              security@bidfedcmmc.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
