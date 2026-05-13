import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | BidFedCMMC",
  description:
    "Custodia, LLC privacy policy — U.S.-built, U.S.-operated cybersecurity compliance software, federally-aligned data handling.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Privacy Policy</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC, Pittsburgh, Pennsylvania, USA
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Who we are and what this policy covers</h2>
          <p>
            Custodia, LLC, a Pennsylvania limited liability company headquartered in
            Pittsburgh, Pennsylvania (&ldquo;BidFedCMMC,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;), operates a U.S.-built, U.S.-operated
            cybersecurity compliance platform at{" "}
            <a href="https://bidfedcmmc.com" className="text-emerald-700 underline">
              bidfedcmmc.com
            </a>{" "}
            (the &ldquo;Service&rdquo;). The Service supports U.S. federal and defense
            contractors in meeting their obligations under the Federal Acquisition
            Regulation (FAR), the Defense Federal Acquisition Regulation Supplement
            (DFARS), and the Cybersecurity Maturity Model Certification (CMMC) program.
          </p>
          <p>
            This Privacy Policy describes how we collect, use, disclose, retain, and
            safeguard information of customers, prospective customers, and visitors to the
            Service.
          </p>
          <p>
            <strong>Regulatory frameworks our handling aligns to:</strong> NIST SP 800-171
            Rev. 2, FAR 52.204-21, DFARS 252.204-7012, CMMC Level 1 under 32 CFR Part 170,
            the Privacy Act of 1974 (as applicable to a commercial service provider), the
            Pennsylvania Breach of Personal Information Notification Act (73 P.S. &sect;
            2301 et seq.), the federal CAN-SPAM Act, the Telephone Consumer Protection Act
            (TCPA), the Children&apos;s Online Privacy Protection Act (COPPA), and U.S.
            state comprehensive privacy laws including CCPA/CPRA (California), VCDPA
            (Virginia), CPA (Colorado), CTDPA (Connecticut), UCPA (Utah), TDPSA (Texas),
            OCPA (Oregon), MCDPA (Montana), ICDPA (Iowa), DPDPA (Delaware), NJDPA (New
            Jersey), TIPA (Tennessee), MCDPA (Minnesota), MODPA (Maryland), INCDPA
            (Indiana), and the comparable laws of Nebraska, New Hampshire, Rhode Island,
            and Kentucky, in each case to the extent applicable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. United States only</h2>
          <p>
            The Service is offered only to legal entities organized under the laws of, and
            operating from within, the United States. We do not market to or knowingly
            collect information from individuals or entities located in the European
            Economic Area, the United Kingdom, Switzerland, Canada, China, or any
            jurisdiction subject to a comprehensive U.S. sanctions program. If you are
            located outside the United States, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Information we collect</h2>
          <p>We collect only the information needed to deliver the Service.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account data:</strong> name, business email, business phone
              (optional), company name, NAICS codes, UEI/CAGE if provided.
            </li>
            <li>
              <strong>Compliance content:</strong> control responses, evidence files,
              attestations, SPRS scoring data, and assessment artifacts that you upload or
              that the Service generates on your behalf.
            </li>
            <li>
              <strong>Integration metadata (Microsoft 365 / Google Workspace):</strong> if
              you authorize an integration, we read user directory listings, audit-log
              metadata, and policy settings via least-privilege, read-only OAuth scopes.
              We do not read email content, calendar bodies, file contents, or personal
              communications.
            </li>
            <li>
              <strong>Telemetry:</strong> non-personally-identifying usage metrics, error
              logs, IP address, browser/device user-agent, and security event data needed
              for product reliability, abuse prevention, and audit-log integrity.
            </li>
            <li>
              <strong>Communications:</strong> messages sent to support, officer tickets,
              and any feedback you provide.
            </li>
            <li>
              <strong>Billing data:</strong> processed by our PCI-DSS-compliant payment
              processor (Stripe, Inc.). We do not store full payment-card numbers.
            </li>
          </ul>
          <p className="mt-2">
            <strong>What we do NOT collect or knowingly accept:</strong> Social Security
            numbers; Protected Health Information (PHI) regulated by HIPAA; biometric
            identifiers; precise geolocation; data of minors; financial-account numbers
            beyond what the payment processor handles; classified information; export-
            controlled technical data subject to ITAR (22 CFR Parts 120-130) or EAR (15
            CFR Parts 730-774); or Controlled Unclassified Information (CUI). Customers
            must not upload any of the foregoing to the Service. The Service is scoped to
            CMMC Level 1 / FCI and is not authorized for CUI.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. How we use information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide, operate, secure, and improve the Service.</li>
            <li>
              Generate compliance assessments, SPRS-style scores, evidence packages,
              policies, and audit artifacts on your behalf.
            </li>
            <li>
              Send transactional and compliance-relevant communications (account notices,
              evidence-freshness alerts, the weekly Compliance Pulse, security incident
              notifications).
            </li>
            <li>
              Send commercial marketing communications only with a clear opt-out in every
              message, in compliance with CAN-SPAM. We do not send SMS or autodialed calls
              without express prior written consent under the TCPA.
            </li>
            <li>Provide customer support and respond to inquiries.</li>
            <li>
              Detect, investigate, and prevent fraud, abuse, security incidents, and
              violations of our Terms of Service and Acceptable Use Policy.
            </li>
            <li>Comply with U.S. federal, state, and local legal obligations.</li>
          </ul>
          <p className="mt-2">
            <strong>We do not sell personal information.</strong> We do not share
            personal information for cross-context behavioral advertising. We do not use
            customer compliance data to train any third-party generative AI model.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Artificial intelligence disclosure</h2>
          <p>
            The Service uses third-party large-language-model providers (currently
            Anthropic, PBC and OpenAI, L.L.C., both U.S. companies) to power AI features
            including the &ldquo;Charlie&rdquo; virtual compliance officer. Customer
            prompts and uploaded evidence are transmitted to these providers only as
            required to fulfill the request you initiated, are subject to written
            zero-retention agreements, and are not used to train any model. AI-generated
            content is software output, not legal or regulatory advice. You remain
            responsible for reviewing AI-generated content before acting on it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Microsoft 365 and Google Workspace integrations</h2>
          <p>
            When you connect Microsoft 365 or Google Workspace, we use OAuth 2.0 to obtain
            a least-privilege, read-only token to your organization&apos;s tenant. Tokens
            are encrypted at rest using AES-256-GCM with keys protected under AWS KMS.
          </p>
          <p>
            <strong>Use limitation.</strong> We access only the directory, audit-log, and
            policy data necessary to produce evidence for the controls in your active
            assessment. Our use and transfer of information received from Google APIs
            adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-emerald-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. You may revoke our access at any
            time from your tenant admin console or from the in-product settings;
            revocation purges the stored tokens within twenty-four (24) hours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Disclosure to third parties</h2>
          <p>We disclose information only as follows:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Sub-processors</strong> that provide infrastructure, hosting, email,
              authentication, payment processing, and AI inference for the Service. Our
              current list and our change-notice commitment are published at{" "}
              <Link href="/subprocessors" className="text-emerald-700 underline">
                /subprocessors
              </Link>
              .
            </li>
            <li>
              <strong>Legal compliance.</strong> Where required by valid legal process
              (subpoena, court order, statute) issued by a U.S. court or agency. We will
              attempt to notify the affected customer unless prohibited by law.
            </li>
            <li>
              <strong>Corporate transactions.</strong> In connection with a merger,
              acquisition, financing, or sale of substantially all assets, subject to
              equivalent confidentiality and security commitments.
            </li>
            <li>
              <strong>Customer direction.</strong> When you ask us to share your data with
              a designated party (e.g., your MSP, prime contractor, or counsel).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">8. Data residency and security</h2>
          <p>
            Customer data is stored on infrastructure located in the contiguous United
            States. We maintain administrative, technical, and physical safeguards
            informed by NIST SP 800-171 Rev. 2, including:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>TLS 1.2+ in transit; AES-256-GCM at rest with AWS KMS-backed envelope encryption.</li>
            <li>HMAC-signed and hash-anchored audit artifacts to detect tampering.</li>
            <li>Role-based access control with the principle of least privilege.</li>
            <li>Multi-factor authentication required for all administrative access.</li>
            <li>Continuous logging, monitoring, and documented incident-response procedures.</li>
            <li>Annual review of security controls and sub-processor posture.</li>
          </ul>
          <p>
            For details, see our public{" "}
            <Link href="/security" className="text-emerald-700 underline">
              Security overview
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">9. Cyber-incident notification</h2>
          <p>
            In the event of a confirmed unauthorized acquisition of, or access to,
            customer data, we will notify affected customers without unreasonable delay
            and, in any event, within seventy-two (72) hours of confirmation, consistent
            with the spirit of DFARS 252.204-7012(c) and the Pennsylvania Breach of
            Personal Information Notification Act. The notification will describe the
            nature of the incident, the data involved (to the extent known), and the
            remediation steps taken. Where the incident involves personal information
            regulated by a U.S. state, we will also comply with that state&apos;s breach-
            notification timing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">10. Data retention and deletion</h2>
          <p>
            Account and compliance content is retained for the term of your subscription
            plus ninety (90) days after cancellation, after which it is purged. Audit-
            trail records (security and access logs) are retained for one (1) year to
            support our own compliance obligations. You may request earlier deletion of
            your account data by writing to{" "}
            <a href="mailto:support@bidfedcmmc.com" className="text-emerald-700 underline">
              support@bidfedcmmc.com
            </a>
            ; we will complete the request within thirty (30) days unless retention is
            required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">11. Your privacy rights</h2>
          <p>Subject to verification of your identity, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Know what personal information we hold about you.</li>
            <li>Access and obtain a portable copy of that information.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of your information.</li>
            <li>Opt out of marketing communications at any time.</li>
            <li>
              Where applicable under state law, opt out of profiling that produces legal
              or similarly significant effects (we do not engage in such profiling), and
              opt out of the sale or sharing of personal information (we do not sell or
              share).
            </li>
            <li>
              Designate an authorized agent to exercise these rights on your behalf,
              subject to identity verification.
            </li>
            <li>Be free from retaliation or service degradation for exercising these rights.</li>
          </ul>
          <p className="mt-2">
            <strong>Appeals.</strong> If we deny a request, you may appeal by replying to
            our response. Where applicable state law (e.g., Virginia, Colorado,
            Connecticut, Texas) requires it, you may contact the relevant state attorney
            general if you are dissatisfied with the outcome.
          </p>
          <p>
            Submit any rights request to{" "}
            <a href="mailto:privacy@bidfedcmmc.com" className="text-emerald-700 underline">
              privacy@bidfedcmmc.com
            </a>
            . We will respond within forty-five (45) days, extendable by an additional
            forty-five (45) days where reasonably necessary.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">12. Cookies and similar technologies</h2>
          <p>
            We use a small number of first-party cookies and similar technologies that are
            strictly necessary to provide the Service (session authentication, CSRF
            protection, load balancing, fraud prevention). We do not set third-party
            advertising or behavioral-tracking cookies. See our{" "}
            <Link href="/cookies" className="text-emerald-700 underline">
              Cookie notice
            </Link>{" "}
            for the full list.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">13. Children</h2>
          <p>
            The Service is for business use by adults aged 18 or older. We do not
            knowingly collect information from children under 13 (COPPA) or minors under
            the age of majority in the user&apos;s state of residence. If we learn that
            we have collected such information, we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">14. Do Not Track and Global Privacy Control</h2>
          <p>
            Because we do not engage in cross-context behavioral advertising or the sale
            of personal information, the Service treats Do Not Track and Global Privacy
            Control signals consistent with our default no-sale, no-share posture. No
            user action is required.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">15. Data Processing Addendum</h2>
          <p>
            Customers acting as a data controller on behalf of their own end users (for
            example, MSPs and federally-regulated businesses) may request our Data
            Processing Addendum at{" "}
            <Link href="/dpa" className="text-emerald-700 underline">
              /dpa
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">16. Changes to this Policy</h2>
          <p>
            We will provide notice of material changes by email and in-product banner at
            least fourteen (14) days before the changes take effect. The Effective date
            above will be updated accordingly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">17. Contact</h2>
          <p>
            <strong>Custodia, LLC</strong>
            <br />
            615 First Avenue, Suite 1009<br />Pittsburgh, Pennsylvania 15219<br />United States
            <br />
            Privacy:{" "}
            <a href="mailto:privacy@bidfedcmmc.com" className="text-emerald-700 underline">
              privacy@bidfedcmmc.com
            </a>
            <br />
            Support:{" "}
            <a href="mailto:support@bidfedcmmc.com" className="text-emerald-700 underline">
              support@bidfedcmmc.com
            </a>
            <br />
            Security:{" "}
            <a href="mailto:security@bidfedcmmc.com" className="text-emerald-700 underline">
              security@bidfedcmmc.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
