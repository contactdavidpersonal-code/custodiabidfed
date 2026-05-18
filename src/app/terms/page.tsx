import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | BidFedCMMC",
  description:
    "Custodia, LLC terms of service — federal-grade compliance software, governed by U.S. law and aligned to FAR/DFARS/CMMC.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Back to home
      </Link>
      <h1 className="mt-6 mb-2 font-serif text-3xl text-slate-900">Terms of Service</h1>
      <p className="mb-8 text-sm text-slate-500">
        Effective date: May 13, 2026 &middot; Custodia, LLC, Pittsburgh, Pennsylvania, USA
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of these Terms</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) constitute a binding agreement
            between you (the &ldquo;Customer&rdquo;) and Custodia, LLC, a Pennsylvania
            limited liability company headquartered in Pittsburgh, Pennsylvania
            (&ldquo;BidFedCMMC,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;), governing
            your use of the BidFedCMMC compliance platform and the website at{" "}
            <a href="https://bidfedcmmc.com" className="text-emerald-700 underline">
              bidfedcmmc.com
            </a>{" "}
            (collectively, the &ldquo;Service&rdquo;). By creating an account, accessing
            the Service, or clicking &ldquo;I agree,&rdquo; you accept these Terms and
            represent that you have authority to bind your organization. If you do not
            accept these Terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Eligibility &mdash; U.S. business customers only</h2>
          <p>
            The Service is offered only to legal entities organized under the laws of, and
            operating from within, the United States. You represent and warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are a U.S. legal entity (corporation, LLC, partnership, or sole proprietor).</li>
            <li>You are at least 18 years old and have authority to bind the Customer.</li>
            <li>You are not located in, and will not access the Service from, any country subject to a comprehensive U.S. embargo (currently including Cuba, Iran, North Korea, Syria, and the Russia-occupied regions of Ukraine).</li>
            <li>You are not on the U.S. Treasury OFAC Specially Designated Nationals list, the U.S. Commerce Department Denied Persons or Entity List, or any other U.S. Government list of prohibited or restricted parties.</li>
            <li>
              <strong>Section 889 self-certification.</strong> Neither you nor your
              affiliates use covered telecommunications or video-surveillance equipment or
              services produced by Huawei, ZTE, Hytera, Hikvision, or Dahua (or
              subsidiaries) in a manner prohibited by Section 889 of the John S. McCain
              National Defense Authorization Act for Fiscal Year 2019 in a way that would
              cause your use of the Service to constitute a violation.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Description of the Service</h2>
          <p>
            BidFedCMMC is a software-as-a-service platform that helps U.S. federal
            contractors implement, document, and maintain cybersecurity practices aligned
            with FAR Subpart 4.19 and FAR 52.204-21, DFARS 252.204-7012 and
            7019&ndash;7021, NIST SP 800-171 Rev. 2 (the controls relevant to CMMC Level
            1), 32 CFR Part 170, and related federal cybersecurity requirements. The
            Service includes AI-assisted compliance guidance (&ldquo;Charlie&rdquo;),
            evidence management, optional Microsoft 365 and Google Workspace integrations,
            continuous monitoring, and the generation of self-assessment artifacts
            suitable for submission to the Supplier Performance Risk System (SPRS).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Software is not legal, regulatory, or assessment advice</h2>
          <p>
            BidFedCMMC is a commercial software tool. BidFedCMMC is not a law firm, is not
            a registered CMMC Third-Party Assessment Organization (C3PAO), and is not a
            Registered Practitioner Organization (RPO) acting in your name. Information,
            recommendations, and AI-generated content delivered through the Service are
            provided for informational purposes only and do not constitute legal,
            regulatory, or professional compliance advice.
          </p>
          <p>
            The Customer is solely responsible for the truthfulness and accuracy of any
            self-assessment, affirmation, or representation made to the United States
            Government, including but not limited to SPRS submissions and CMMC self-
            assessment affirmations under 32 CFR Part 170. Knowingly false statements may
            give rise to liability under the False Claims Act (31 U.S.C. &sect;&sect;
            3729&ndash;3733), 18 U.S.C. &sect; 1001, and other federal laws. BidFedCMMC
            recommends that Customers engage qualified legal counsel and, where required,
            an authorized C3PAO before submitting any formal certification.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Subscriptions, fees, renewal, cancellation</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Plans and pricing.</strong> The Self Service plan is two hundred
              forty-nine U.S. dollars ($249) per month, or two thousand four hundred ninety-
              six U.S. dollars ($2,496) billed annually. The Self Service + Custodia Officer
              plan is three hundred ninety-seven U.S. dollars ($397) per month, or three
              thousand nine hundred ninety-six U.S. dollars ($3,996) billed annually. The
              Custodia Officer tier provides asynchronous, ticket-based access to a
              credentialed Custodia Compliance Officer assigned to the Customer&apos;s account,
              scoped to CMMC Level 1 guidance; target response time is one (1) business
              day during Custodia&apos;s business hours (Monday through Friday, 9:00 a.m. to
              4:00 p.m. U.S. Eastern Time, excluding U.S. federal holidays). The Officer
              tier does not constitute 24/7 consulting, implementation services, third-
              party assessment, or coverage of frameworks outside CMMC Level 1 (including
              but not limited to CMMC Level 2, DFARS 252.204-7012, CUI handling, ITAR,
              EAR, FedRAMP, HIPAA, SOC 2, or ISO 27001), which are separately scoped
              engagements. All fees are exclusive of applicable sales, use, value-added,
              or similar taxes, which the Customer is responsible for paying.
            </li>
            <li>
              <strong>Free trial.</strong> New customers receive a fourteen (14) day free
              trial. No charge is made until the trial ends. To avoid being charged,
              cancel before the end of the trial period from in-product billing settings.
            </li>
            <li>
              <strong>Auto-renewal.</strong> Subscriptions auto-renew on a monthly basis
              until cancelled. Cancellation takes effect at the end of the then-current
              billing period and the Customer retains access through that period.
            </li>
            <li>
              <strong>Non-refundable fees.</strong> Except as expressly required by
              applicable law, all subscription fees are non-refundable. The Customer may
              cancel at any time through in-product billing settings.
            </li>
            <li>
              <strong>Success Guarantee.</strong> Upon enrollment, BidFedCMMC will provide
              continued platform access and, on the Officer plan, assigned credentialed-
              officer assistance to help the Customer rebuild a CMMC Level 1 package
              produced by the Service that the Customer or its prime determines to be not
              defensible to FAR 52.204-21 standard. The Customer&apos;s sole and exclusive
              remedy under this guarantee is the continued service described in this
              paragraph. <strong>This guarantee does not guarantee any particular outcome,
              award, audit result, or contract.</strong>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Acceptable use</h2>
          <p>
            Use of the Service is subject to our{" "}
            <Link href="/acceptable-use" className="text-emerald-700 underline">
              Acceptable Use Policy
            </Link>
            , which is incorporated by reference. Without limiting that policy, the
            Customer agrees not to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Submit false, fabricated, or fraudulent compliance data, evidence, or attestations.</li>
            <li>Use the Service to facilitate fraud or misrepresentation against the United States Government, any prime contractor, or any other party.</li>
            <li>Upload Controlled Unclassified Information (CUI), classified information, Protected Health Information (PHI), or any data subject to ITAR (22 CFR 120&ndash;130) or EAR (15 CFR 730&ndash;774) restrictions, unless the Customer has obtained written authorization from BidFedCMMC and has subscribed to a service tier that expressly covers such data.</li>
            <li>Reverse-engineer, decompile, scrape, sublicense, white-label, or resell the Service.</li>
            <li>Attempt to gain unauthorized access to other customers&apos; tenants, data, or accounts.</li>
            <li>Interfere with the integrity of audit logs, attestation signatures, or evidence hashes.</li>
            <li>Use the Service to develop a competing product.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Customer data ownership and license</h2>
          <p>
            The Customer retains ownership of all data, evidence, and content uploaded to
            or generated within the Service (&ldquo;Customer Data&rdquo;). The Customer
            grants BidFedCMMC a limited, non-exclusive, royalty-free license to host,
            process, transmit, and display Customer Data solely as needed to deliver the
            Service. We may use de-identified, aggregated data derived from the operation
            of the Service to improve and benchmark the Service, provided that such data
            cannot reasonably be re-associated with any Customer.
          </p>
          <p>
            Our collection, use, and protection of personal information are governed by
            our{" "}
            <Link href="/privacy" className="text-emerald-700 underline">
              Privacy Policy
            </Link>
            . Customers processing personal information on behalf of others may request
            our{" "}
            <Link href="/dpa" className="text-emerald-700 underline">
              Data Processing Addendum
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">8. Third-party integrations</h2>
          <p>
            By authorizing a Microsoft 365 or Google Workspace integration, the Customer
            represents that it has authority to grant BidFedCMMC read-only access to the
            authorized tenant and that such access does not violate the Customer&apos;s
            own policies, contracts, or applicable law. Our use of data obtained from
            these integrations is described in our Privacy Policy and is restricted to
            generating compliance evidence on the Customer&apos;s behalf.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">9. Confidentiality</h2>
          <p>
            Each party will protect the other party&apos;s confidential information with
            the same care it uses to protect its own confidential information of like
            importance (and in no event less than a reasonable standard of care).
            BidFedCMMC&apos;s obligations include the security controls described in our
            Privacy Policy and at our public{" "}
            <Link href="/security" className="text-emerald-700 underline">
              Security overview
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">10. Cyber-incident notification</h2>
          <p>
            In the event of a confirmed unauthorized acquisition of, or access to,
            Customer Data, BidFedCMMC will notify the affected Customer without
            unreasonable delay and, in any event, within seventy-two (72) hours of
            confirmation, consistent with the spirit of DFARS 252.204-7012(c) and the
            Pennsylvania Breach of Personal Information Notification Act. The Customer
            remains responsible for any onward notification it owes to the U.S.
            Department of Defense or other contracting agencies under its own contracts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">11. Warranties and disclaimers</h2>
          <p>
            BidFedCMMC warrants that it will provide the Service in a professional and
            workmanlike manner consistent with industry standards. EXCEPT FOR THIS LIMITED
            WARRANTY, AND TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
            &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; BIDFEDCMMC EXPRESSLY
            DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING THE IMPLIED
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. BIDFEDCMMC DOES NOT WARRANT THAT USE OF THE SERVICE WILL
            RESULT IN AWARD OF ANY PARTICULAR CONTRACT, AVOIDANCE OF AUDIT FINDINGS,
            ACHIEVEMENT OF ANY REGULATORY OUTCOME, OR ELIGIBILITY FOR ANY GOVERNMENT
            PROGRAM. BETA OR EARLY-ACCESS FEATURES ARE PROVIDED ON AN UNSUPPORTED BASIS
            AND WITHOUT WARRANTY OF ANY KIND.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">12. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BIDFEDCMMC&apos;S AGGREGATE LIABILITY
            ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE
            FEES PAID BY THE CUSTOMER TO BIDFEDCMMC IN THE TWELVE (12) MONTHS PRECEDING
            THE EVENT GIVING RISE TO THE CLAIM. IN NO EVENT WILL BIDFEDCMMC BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
            INCLUDING BUT NOT LIMITED TO LOSS OF CONTRACTS, LOSS OF AWARDS, DEBARMENT,
            REPUTATIONAL HARM, OR LOST PROFITS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
            DAMAGES. THESE LIMITATIONS APPLY REGARDLESS OF THE LEGAL THEORY ON WHICH ANY
            CLAIM IS BASED.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">13. Indemnification</h2>
          <p>
            The Customer shall indemnify, defend, and hold harmless BidFedCMMC and its
            members, officers, directors, employees, and agents from and against any
            third-party claims arising out of (a) the Customer&apos;s breach of these
            Terms, (b) the Customer&apos;s violation of applicable law, including any
            false certification or representation made to a U.S. Government entity, or
            (c) the Customer&apos;s misuse of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">14. Anti-bribery and anti-corruption</h2>
          <p>
            Each party will comply with all applicable anti-bribery and anti-corruption
            laws, including the U.S. Foreign Corrupt Practices Act (15 U.S.C. &sect;&sect;
            78dd-1 et seq.) and 18 U.S.C. &sect; 201. Neither party will offer or accept
            anything of value to or from a government official or any other person for the
            purpose of improperly influencing a decision related to the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">15. Term and termination</h2>
          <p>
            These Terms remain in effect for so long as the Customer maintains an active
            account. Either party may terminate for material breach if the breach is not
            cured within thirty (30) days of written notice. BidFedCMMC may suspend or
            terminate accounts immediately for violations of the Acceptable Use Policy,
            non-payment, or activity that poses a security or legal risk. Upon
            termination, the Customer may export its data for a period of thirty (30)
            days, after which BidFedCMMC will purge Customer Data in accordance with the
            retention schedule in our Privacy Policy. Sections 4, 7, 9, 11&ndash;14, 17,
            18, and 20 survive termination.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">16. Force majeure</h2>
          <p>
            Neither party will be liable for delay or failure to perform caused by events
            beyond its reasonable control, including acts of God, war, terrorism, civil
            unrest, labor disputes, government action, internet or telecommunications
            failure, cyber-attack on third-party infrastructure, or pandemic. The affected
            party will use commercially reasonable efforts to resume performance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">17. Governing law and dispute resolution</h2>
          <p>
            These Terms are governed by the laws of the Commonwealth of Pennsylvania and
            the federal laws of the United States, without regard to conflict-of-law
            principles.
          </p>
          <p>
            <strong>Informal resolution first.</strong> Before filing any claim, the
            parties will attempt in good faith to resolve the dispute by negotiation
            between authorized representatives for at least thirty (30) days after written
            notice.
          </p>
          <p>
            <strong>Exclusive forum.</strong> If the dispute is not resolved informally,
            any dispute arising out of or relating to these Terms shall be resolved
            exclusively in the state or federal courts located in Allegheny County,
            Pennsylvania, and the parties consent to the personal jurisdiction of those
            courts. EACH PARTY IRREVOCABLY WAIVES ANY RIGHT TO A JURY TRIAL. Nothing in
            this Section limits either party&apos;s right to seek injunctive or equitable
            relief in any court of competent jurisdiction.
          </p>
          <p>
            <strong>Class action waiver.</strong> Each party agrees that any claim must be
            brought in the parties&apos; individual capacities and not as a plaintiff or
            class member in any purported class, consolidated, or representative action.
          </p>
          <p>
            <strong>Time limitation.</strong> Any cause of action arising out of or
            relating to these Terms must be commenced within one (1) year after the cause
            of action accrues, otherwise it is permanently barred.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">18. U.S. Government end users</h2>
          <p>
            The Service is &ldquo;commercial computer software&rdquo; and &ldquo;commercial
            computer software documentation&rdquo; pursuant to FAR 12.212 and DFARS
            227.7202. U.S. Government end users acquire the Service with only those rights
            set forth in these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">19. Export control</h2>
          <p>
            The Customer represents that it will not export, re-export, or transfer the
            Service or any technical data derived from it in violation of U.S. export-
            control laws, including the Export Administration Regulations (15 CFR
            730&ndash;774) and the International Traffic in Arms Regulations (22 CFR
            120&ndash;130).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">20. DMCA copyright agent</h2>
          <p>
            To report alleged copyright infringement under the Digital Millennium
            Copyright Act (17 U.S.C. &sect; 512), send a written notice meeting the DMCA
            requirements to{" "}
            <a href="mailto:dmca@bidfedcmmc.com" className="text-emerald-700 underline">
              dmca@bidfedcmmc.com
            </a>
            . We may terminate the accounts of repeat infringers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">21. Notices, electronic communications, and consent</h2>
          <p>
            The Customer consents to receive notices and communications from BidFedCMMC
            electronically (email, in-product banners) under the federal E-Sign Act (15
            U.S.C. &sect;&sect; 7001 et seq.). Legal notices to BidFedCMMC must be sent
            to the address in Section 23 with a copy to{" "}
            <a href="mailto:legal@bidfedcmmc.com" className="text-emerald-700 underline">
              legal@bidfedcmmc.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">22. Changes to these Terms</h2>
          <p>
            We may revise these Terms from time to time. We will provide notice of
            material changes by email and in-product banner at least fourteen (14) days
            before the changes take effect. Continued use of the Service after the
            effective date constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">23. Miscellaneous and contact</h2>
          <p>
            These Terms (together with the Privacy Policy and Acceptable Use Policy) are
            the entire agreement between the parties regarding the Service and supersede
            all prior agreements. If any provision is held unenforceable, the remaining
            provisions remain in full force. Failure to enforce any right is not a waiver.
            Neither party may assign these Terms without the other&apos;s prior written
            consent, except in connection with a merger, acquisition, or sale of
            substantially all of its assets. There are no third-party beneficiaries.
          </p>
          <p>
            <strong>Custodia, LLC</strong>
            <br />
            6375 Penn Avenue, Suite B #1246<br />Pittsburgh, Pennsylvania 15206<br />United States
            <br />
            Legal:{" "}
            <a href="mailto:legal@bidfedcmmc.com" className="text-emerald-700 underline">
              legal@bidfedcmmc.com
            </a>
            <br />
            Support:{" "}
            <a href="mailto:support@bidfedcmmc.com" className="text-emerald-700 underline">
              support@bidfedcmmc.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
