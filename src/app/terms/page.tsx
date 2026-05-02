import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Custodia",
  description:
    "Custodia terms of service — federal-grade compliance software, governed by U.S. law and aligned to FAR/DFARS/CMMC.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Terms of Service</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 2, 2026 &middot; Custodia, Pittsburgh, Pennsylvania, USA
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of these Terms</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) constitute a binding agreement
            between you (the &ldquo;Customer&rdquo;) and Custodia, a U.S. company
            headquartered in Pittsburgh, Pennsylvania (&ldquo;Custodia,&rdquo; &ldquo;we,&rdquo; or
            &ldquo;us&rdquo;), governing your use of the Custodia compliance platform and
            the website at{" "}
            <a href="https://bidfedcmmc.com" className="text-emerald-700 underline">
              bidfedcmmc.com
            </a>{" "}
            (collectively, the &ldquo;Service&rdquo;). By creating an account, accessing the
            Service, or clicking &ldquo;I agree,&rdquo; you accept these Terms and represent
            that you have authority to bind your organization.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Description of the Service</h2>
          <p>
            Custodia is a software-as-a-service platform that helps U.S. federal contractors
            implement, document, and maintain cybersecurity practices aligned with the
            Federal Acquisition Regulation (FAR) Subpart 4.19 and FAR 52.204-21, the Defense
            Federal Acquisition Regulation Supplement (DFARS) 252.204-7012 and 252.204-7019
            through 7021, NIST SP 800-171 Rev. 2 (the controls relevant to CMMC Level 1),
            32 CFR Part 170 (the CMMC program rule), and related federal cybersecurity
            requirements. The Service includes AI-assisted compliance guidance
            (&ldquo;Charlie&rdquo;), evidence management, optional Microsoft 365 and Google
            Workspace integrations, continuous monitoring, and the generation of
            self-assessment artifacts suitable for submission to the Supplier Performance
            Risk System (SPRS).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Software is not legal, regulatory, or assessment advice</h2>
          <p>
            Custodia is a commercial software tool. Custodia is not a law firm, not a
            registered Cyber AB / CMMC Third-Party Assessment Organization (C3PAO), and not
            a Registered Practitioner Organization (RPO) acting in your name. Information,
            recommendations, and AI-generated content delivered through the Service are
            provided for informational purposes only and do not constitute legal,
            regulatory, or professional compliance advice.
          </p>
          <p>
            The Customer is solely responsible for the truthfulness and accuracy of any
            self-assessment, affirmation, or representation made to the United States
            Government, including but not limited to SPRS submissions and CMMC
            self-assessment affirmations under 32 CFR Part 170. Knowingly false statements
            may give rise to liability under the False Claims Act (31 U.S.C. &sect;&sect;
            3729-3733) and other federal laws. Custodia recommends that Customers engage
            qualified legal counsel and, where required, an authorized C3PAO before
            submitting any formal certification.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Subscriptions, fees, and renewal</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>The standard subscription fee is two hundred forty-nine U.S. dollars ($249) per month, exclusive of applicable taxes.</li>
            <li>New customers receive a fourteen (14) day free trial. No charge is made until the trial ends.</li>
            <li>Subscriptions auto-renew on a monthly basis until cancelled. Cancellation takes effect at the end of the then-current billing period.</li>
            <li>
              <strong>Money-back assurance:</strong> within the first thirty (30) days of a paid subscription, a Customer who is not satisfied may request and receive a refund of that month&apos;s subscription fee. After thirty (30) days, fees are non-refundable.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Acceptable use</h2>
          <p>The Customer agrees not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Submit false, fabricated, or fraudulent compliance data, evidence, or attestations.</li>
            <li>Use the Service to facilitate fraud, misrepresentation, or wire-fraud against the United States Government, any prime contractor, or any other party.</li>
            <li>Upload Controlled Unclassified Information (CUI), classified information, or any data subject to International Traffic in Arms Regulations (ITAR) or Export Administration Regulations (EAR) restrictions, unless the Customer has obtained written authorization from Custodia and has subscribed to a CUI-authorized service tier.</li>
            <li>Reverse-engineer, decompile, scrape, sublicense, white-label, or resell the Service without prior written agreement.</li>
            <li>Attempt to gain unauthorized access to other customers&apos; tenants, data, or accounts.</li>
            <li>Interfere with the integrity of audit logs, attestation signatures, or evidence hashes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Customer data ownership and license</h2>
          <p>
            The Customer retains ownership of all data, evidence, and content uploaded to or
            generated within the Service. The Customer grants Custodia a limited,
            non-exclusive, royalty-free license to host, process, transmit, and display
            Customer data solely as needed to deliver the Service. Custodia&apos;s
            collection, use, and protection of personal information are governed by our{" "}
            <Link href="/privacy" className="text-emerald-700 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Third-party integrations</h2>
          <p>
            By authorizing a Microsoft 365 or Google Workspace integration, the Customer
            represents that it has authority to grant Custodia read-only access to the
            authorized tenant and that such access does not violate the Customer&apos;s own
            policies, contracts, or applicable law. Custodia&apos;s use of data obtained
            from these integrations is described in our Privacy Policy and is restricted to
            generating compliance evidence on the Customer&apos;s behalf.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">8. Confidentiality</h2>
          <p>
            Each party will protect the other party&apos;s confidential information with the
            same care it uses to protect its own confidential information of like importance
            (and in no event less than a reasonable standard of care). Custodia&apos;s
            obligations include the security controls described in Section 6 of our Privacy
            Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">9. Cyber-incident notification</h2>
          <p>
            In the event of a confirmed unauthorized disclosure of Customer data, Custodia
            will notify the affected Customer without unreasonable delay and, in any event,
            within seventy-two (72) hours of confirmation, consistent with the spirit of
            DFARS 252.204-7012(c). The Customer remains responsible for any onward
            notification it owes to the U.S. Department of Defense or other contracting
            agencies pursuant to its own contract terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">10. Warranties and disclaimers</h2>
          <p>
            Custodia warrants that it will provide the Service in a professional and
            workmanlike manner consistent with industry standards. EXCEPT FOR THIS LIMITED
            WARRANTY, AND TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
            &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; CUSTODIA EXPRESSLY DISCLAIMS
            ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING THE IMPLIED WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            CUSTODIA DOES NOT WARRANT THAT USE OF THE SERVICE WILL RESULT IN AWARD OF ANY
            PARTICULAR CONTRACT, AVOIDANCE OF AUDIT FINDINGS, OR ACHIEVEMENT OF ANY
            REGULATORY OUTCOME.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">11. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, CUSTODIA&apos;S AGGREGATE LIABILITY
            ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE
            FEES PAID BY THE CUSTOMER TO CUSTODIA IN THE TWELVE (12) MONTHS PRECEDING THE
            EVENT GIVING RISE TO THE CLAIM. IN NO EVENT WILL CUSTODIA BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT
            NOT LIMITED TO LOSS OF CONTRACTS, LOSS OF AWARDS, DEBARMENT, REPUTATIONAL HARM,
            OR LOST PROFITS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THESE
            LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY ON WHICH ANY CLAIM IS BASED.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">12. Indemnification</h2>
          <p>
            The Customer shall indemnify, defend, and hold harmless Custodia and its
            officers, directors, and employees from and against any third-party claims
            arising out of (a) the Customer&apos;s breach of these Terms, (b) the
            Customer&apos;s violation of applicable law, including any false certification or
            representation made to a U.S. Government entity, or (c) the Customer&apos;s
            misuse of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">13. Term and termination</h2>
          <p>
            These Terms remain in effect for so long as the Customer maintains an active
            account. Either party may terminate for material breach if the breach is not
            cured within thirty (30) days of written notice. Custodia may suspend or
            terminate accounts immediately for violations of Section 5 (Acceptable Use),
            non-payment, or activity that poses a security or legal risk. Upon termination,
            the Customer may export its data for a period of thirty (30) days, after which
            Custodia will purge Customer data in accordance with the retention schedule in
            our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">14. Governing law and dispute resolution</h2>
          <p>
            These Terms are governed by the laws of the Commonwealth of Pennsylvania and
            the federal laws of the United States, without regard to conflict-of-law
            principles. Any dispute arising out of or relating to these Terms shall be
            resolved exclusively in the state or federal courts located in Allegheny County,
            Pennsylvania, and the parties consent to the personal jurisdiction of those
            courts. Each party waives any right to a jury trial. Nothing in this Section
            limits either party&apos;s right to seek injunctive or equitable relief in any
            court of competent jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">15. U.S. Government end users</h2>
          <p>
            The Service is &ldquo;commercial computer software&rdquo; and &ldquo;commercial
            computer software documentation&rdquo; pursuant to FAR 12.212 and DFARS
            227.7202. U.S. Government end users acquire the Service with only those rights
            set forth in these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">16. Export control</h2>
          <p>
            The Customer represents that it is not located in, and will not access the
            Service from, any country subject to a U.S. Government embargo, and that it is
            not on any U.S. Government list of prohibited or restricted parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">17. Changes to these Terms</h2>
          <p>
            We may revise these Terms from time to time. We will provide notice of material
            changes by email and in-product banner at least fourteen (14) days before the
            changes take effect. Continued use of the Service after the effective date
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">18. Miscellaneous</h2>
          <p>
            These Terms (together with the Privacy Policy) are the entire agreement between
            the parties regarding the Service and supersede all prior agreements. If any
            provision is held unenforceable, the remaining provisions remain in full force.
            Failure to enforce any right is not a waiver. Neither party may assign these
            Terms without the other&apos;s prior written consent, except in connection with
            a merger, acquisition, or sale of substantially all of its assets.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">19. Contact</h2>
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
