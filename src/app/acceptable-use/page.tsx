import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | BidFedCMMC",
  description:
    "Acceptable use policy for the BidFedCMMC compliance platform — prohibited content and conduct.",
};

export default function AcceptableUsePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Acceptable Use Policy</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC, Pittsburgh, Pennsylvania, USA
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <p>
            This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs all use of the
            BidFedCMMC platform (the &ldquo;Service&rdquo;) and is incorporated by
            reference into our{" "}
            <Link href="/terms" className="text-emerald-700 underline">
              Terms of Service
            </Link>
            . Violation of this AUP is a material breach of the Terms and may result in
            immediate suspension or termination, with or without notice, and may be
            reported to law enforcement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Prohibited content</h2>
          <p>You may not upload, store, transmit, or process through the Service:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Controlled Unclassified Information (CUI) of any category.</li>
            <li>Classified information of any level.</li>
            <li>Protected Health Information (PHI) regulated by HIPAA.</li>
            <li>Payment-card primary account numbers (PAN) outside of the supported payment processor.</li>
            <li>Social Security numbers, biometric identifiers, or precise geolocation of natural persons.</li>
            <li>Technical data subject to ITAR (22 CFR 120&ndash;130) or EAR (15 CFR 730&ndash;774) restrictions, unless a specific written authorization from BidFedCMMC is in place.</li>
            <li>Data of children under 13 (COPPA) or other minors.</li>
            <li>Personal data of individuals located outside the United States that triggers obligations under non-U.S. law (e.g., GDPR, UK GDPR, PIPL).</li>
            <li>Content that is unlawful, defamatory, harassing, fraudulent, infringing, obscene, or that promotes violence or discrimination.</li>
            <li>Malware, ransomware, exploit code, or other malicious payloads.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Prohibited conduct</h2>
          <p>You may not:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Submit false, fabricated, or fraudulent compliance evidence, attestations, or affirmations through the Service.</li>
            <li>Use the Service to facilitate any fraud, false claim, wire fraud, or misrepresentation against the United States Government, any prime contractor, or any other party. False statements may be prosecuted under the False Claims Act (31 U.S.C. &sect;&sect; 3729&ndash;3733) and 18 U.S.C. &sect; 1001.</li>
            <li>Reverse-engineer, decompile, disassemble, scrape, frame, mirror, sublicense, white-label, or resell the Service.</li>
            <li>Use automated means to access the Service except as expressly permitted by published APIs.</li>
            <li>Attempt to gain unauthorized access to any account, tenant, system, or data not your own.</li>
            <li>Probe, scan, or test the vulnerability of the Service except under a written authorization from BidFedCMMC (see our{" "}
              <Link href="/security" className="text-emerald-700 underline">
                Security overview
              </Link>{" "}
              for the coordinated-disclosure process).
            </li>
            <li>Circumvent rate limits, authentication, audit logging, attestation signatures, or evidence-hash integrity controls.</li>
            <li>Use the Service to develop, train, or benchmark a competing product or model.</li>
            <li>Use the Service to send unsolicited bulk email, SMS, or autodialed calls.</li>
            <li>Misuse AI features to generate misleading evidence, impersonate persons, or evade compliance obligations.</li>
            <li>Use the Service in connection with sanctioned persons or jurisdictions, or in violation of U.S. export-control laws.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Account hygiene</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Keep your credentials confidential. Enable multi-factor authentication when offered.</li>
            <li>Notify us promptly if you suspect unauthorized access at{" "}
              <a href="mailto:security@bidfedcmmc.com" className="text-emerald-700 underline">
                security@bidfedcmmc.com
              </a>
              .</li>
            <li>Each user must use their own account. Do not share logins.</li>
            <li>Promptly remove access for users who leave your organization.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Enforcement</h2>
          <p>
            BidFedCMMC may investigate suspected violations of this AUP. We may remove
            content, suspend, or terminate access immediately if we determine, in our
            reasonable discretion, that conduct violates this AUP or poses a risk to the
            Service, our customers, or any third party. Where required by law or where
            public safety is at risk, we may cooperate with law enforcement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Reporting violations</h2>
          <p>
            Report suspected violations to{" "}
            <a href="mailto:abuse@bidfedcmmc.com" className="text-emerald-700 underline">
              abuse@bidfedcmmc.com
            </a>
            . Report security vulnerabilities to{" "}
            <a href="mailto:security@bidfedcmmc.com" className="text-emerald-700 underline">
              security@bidfedcmmc.com
            </a>{" "}
            (see also{" "}
            <a href="/.well-known/security.txt" className="text-emerald-700 underline">
              /.well-known/security.txt
            </a>
            ).
          </p>
        </section>
      </div>
    </main>
  );
}
