import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import {
  Callout,
  H2,
  H3,
  P,
  Prose,
  Quote,
  TOC,
} from "@/app/blog/_components/BlogShell";

const meta = {
  slug: "cmmc-level-1-17-practices-explained",
  title:
    "CMMC Level 1: All 17 Practices Explained in Plain English (2026 Guide)",
  description:
    "A complete, plain-English walkthrough of every CMMC Level 1 practice — what each FAR 52.204-21 control actually requires, what evidence you need, and the fastest way to implement it. Updated for the 2026 SPRS affirmation cycle.",
  excerpt:
    "Every CMMC Level 1 practice, in language a non-cybersecurity founder can act on — what each control means, what evidence satisfies it, and where teams trip up.",
  datePublished: "2026-05-03",
  category: "CMMC Level 1",
  keywords: [
    "cmmc level 1 practices",
    "far 52.204-21 practices",
    "cmmc level 1 self assessment",
    "cmmc 17 practices",
    "cmmc level 1 controls",
    "cmmc level 1 plain english",
  ],
  readingMinutes: 14,
  author: {
    name: "Custodia Compliance Team",
    title: "Carnegie Mellon-trained information security engineers",
  },
};

const TOC_ITEMS = [
  { id: "what-is-cmmc-l1", label: "What CMMC Level 1 actually is" },
  { id: "ac", label: "Access Control (AC) — 4 practices" },
  { id: "ia", label: "Identification & Authentication (IA) — 2 practices" },
  { id: "mp", label: "Media Protection (MP) — 1 practice" },
  { id: "pe", label: "Physical Protection (PE) — 4 practices" },
  { id: "sc", label: "System & Communications Protection (SC) — 2 practices" },
  { id: "si", label: "System & Information Integrity (SI) — 4 practices" },
  { id: "implement", label: "How to actually implement these in a week" },
  { id: "faq", label: "FAQ" },
];

function Body() {
  return (
    <Prose>
      <P>
        If you handle Federal Contract Information (FCI) on a Department of
        Defense contract, you have to attest to 17 specific cybersecurity
        practices in <strong>SPRS</strong> &mdash; the DoD&apos;s Supplier
        Performance Risk System &mdash; before you can keep that contract.
        Those 17 practices are <strong>CMMC Level 1</strong>, and they&apos;re
        the exact same 17 controls written into{" "}
        <strong>FAR 52.204-21</strong>, the &ldquo;Basic Safeguarding of
        Covered Contractor Information Systems&rdquo; clause that the
        government has been quietly putting in contracts since 2016.
      </P>
      <P>
        The problem isn&apos;t the practices themselves &mdash; most of them
        are common sense. The problem is that they&apos;re written in
        cybersecurity jargon that a five-person defense-tech startup
        cannot reasonably parse. So below is every single one in plain
        English, with the evidence you actually need to satisfy it.
      </P>

      <TOC items={TOC_ITEMS} />

      <H2 id="what-is-cmmc-l1">What CMMC Level 1 actually is</H2>
      <P>
        CMMC Level 1 is a <strong>self-attestation</strong>. You implement
        all 17 practices, you submit a SPRS affirmation signed by a senior
        official, and you&apos;re bid-eligible for any DoD contract that
        flows down FCI. There is no third-party assessor for Level 1; you
        sign your name and you live with the consequences if you&apos;re
        wrong (more on that in our{" "}
        <Link
          href="/blog/sprs-score-explained-and-how-to-respond-to-prime"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          SPRS score guide
        </Link>
        ).
      </P>
      <Callout tone="warn" title="Why this is not optional">
        Filing a SPRS affirmation that isn&apos;t accurate is a federal
        false statement under <strong>18 U.S.C. § 1001</strong> and
        actionable under the <strong>False Claims Act (31 U.S.C. § 3729)</strong>.
        The DOJ&apos;s Civil Cyber-Fraud Initiative has produced settlements
        ranging from $1M to $9M+ since 2022. &ldquo;We&apos;ll fix it later&rdquo;
        is not a strategy.
      </Callout>
      <P>
        The 17 practices are organized into six families. Each one has a
        formal identifier (e.g. <code>AC.L1-3.1.1</code>) that maps to NIST
        SP 800-171. Below, every practice is paired with what it means,
        what evidence satisfies it, and where teams typically trip up.
      </P>

      {/* Access Control */}
      <H2 id="ac">Access Control (AC) — 4 practices</H2>

      <H3 id="ac-1">AC.L1-3.1.1 — Limit access to authorized users</H3>
      <P>
        <strong>Plain English:</strong> Only people who work for you (or
        whom you&apos;ve formally invited) can sign into the systems where
        FCI lives. No shared accounts. No &ldquo;the intern uses the
        founder&apos;s login.&rdquo;
      </P>
      <P>
        <strong>Evidence that satisfies it:</strong> a signed
        <em> Authorized Users Roster</em> (name, role, system, date access
        granted) and a screenshot of your identity provider showing the
        same names &mdash; Microsoft 365 admin center, Google Workspace
        admin, Okta, or whatever you use. The two have to match.
      </P>

      <H3 id="ac-2">AC.L1-3.1.2 — Limit transactions and functions to those users are authorized to perform</H3>
      <P>
        <strong>Plain English:</strong> Not everyone gets admin. Engineering
        gets engineering, finance gets finance, the receptionist
        doesn&apos;t get production database access.
      </P>
      <P>
        <strong>Evidence:</strong> a <em>role matrix</em> mapping job title
        to system permissions, plus a screenshot of role assignments in
        your IdP. If you&apos;re using M365, that&apos;s the Roles &amp;
        admins page; in Google Workspace, it&apos;s Admin roles.
      </P>

      <H3 id="ac-3">AC.L1-3.1.20 — Verify and control connections to external systems</H3>
      <P>
        <strong>Plain English:</strong> If your laptops or servers connect
        out to third-party SaaS, partner networks, or contractor systems,
        you have to know which ones and you have to control them.
      </P>
      <P>
        <strong>Evidence:</strong> an <em>External Systems Inventory</em>
        listing every SaaS app and partner network you connect to, plus
        the policy or admin setting that approves it. Most teams build this
        inventory by exporting the OAuth grants from M365/Google.
      </P>

      <H3 id="ac-4">AC.L1-3.1.22 — Control information posted publicly</H3>
      <P>
        <strong>Plain English:</strong> Before anything goes on your public
        website or social media, someone makes sure it&apos;s not FCI.
        That sounds obvious until your sales engineer tweets a screenshot
        of a slide deck with a customer logo on it.
      </P>
      <P>
        <strong>Evidence:</strong> a brief written posting policy and a
        signed acknowledgment from anyone with authority to publish on
        behalf of the company.
      </P>

      {/* Identification & Authentication */}
      <H2 id="ia">Identification &amp; Authentication (IA) — 2 practices</H2>

      <H3 id="ia-1">IA.L1-3.5.1 — Identify users and devices</H3>
      <P>
        <strong>Plain English:</strong> Every person and every device that
        touches your systems has a unique, traceable identity. No
        &ldquo;laptop3&rdquo; or &ldquo;dev-machine.&rdquo; Real names,
        real hostnames, in a real inventory.
      </P>
      <P>
        <strong>Evidence:</strong> Your authorized users roster (covers
        people) plus an <em>Access Device Register</em> listing every
        laptop, desktop, and managed phone with hostname, owner, and OS.
        Microsoft Intune and Google Endpoint Management both export this.
      </P>

      <H3 id="ia-2">IA.L1-3.5.2 — Authenticate users and devices</H3>
      <P>
        <strong>Plain English:</strong> Passwords alone aren&apos;t good
        enough. You need <strong>multi-factor authentication (MFA)</strong>{" "}
        on the systems where FCI lives. This is the single highest-leverage
        practice on the list and the one most failed audits hinge on.
      </P>
      <P>
        <strong>Evidence:</strong> a screenshot of your IdP&apos;s MFA
        enforcement policy showing it applies to all users, plus a current
        MFA enrollment report. SMS-based MFA technically counts at L1, but
        TOTP (Authenticator app) or hardware keys are the right answer.
      </P>

      {/* Media Protection */}
      <H2 id="mp">Media Protection (MP) — 1 practice</H2>

      <H3 id="mp-1">MP.L1-3.8.3 — Sanitize media before disposal or reuse</H3>
      <P>
        <strong>Plain English:</strong> When a laptop, USB drive, or hard
        disk leaves the company &mdash; sale, donation, trash, RMA &mdash;
        the data on it is gone. Cryptographic erase, full disk wipe, or
        physical destruction.
      </P>
      <P>
        <strong>Evidence:</strong> a <em>Media Disposal Log</em> with serial
        number, disposal date, method (NIST 800-88 wipe / shredded /
        crypto-erased), and the name of the person who did it. One row per
        retired device.
      </P>

      {/* Physical Protection */}
      <H2 id="pe">Physical Protection (PE) — 4 practices</H2>

      <H3 id="pe-1">PE.L1-3.10.1 — Limit physical access to organizational systems</H3>
      <P>
        <strong>Plain English:</strong> Random people can&apos;t walk into
        the room with your servers, your network closet, or the desks
        where FCI is on screen.
      </P>
      <P>
        <strong>Evidence:</strong> a <em>Physical Access Roster</em> &mdash;
        who has badge, key, or door-code access to FCI areas. If you work
        from a coworking space or home offices, document that explicitly
        and describe the lock-and-key controls that apply.
      </P>

      <H3 id="pe-2">PE.L1-3.10.3 — Escort visitors and monitor visitor activity</H3>
      <P>
        <strong>Plain English:</strong> If a non-employee comes into your
        FCI area, an employee is with them the whole time and you write
        down that they came in.
      </P>
      <P>
        <strong>Evidence:</strong> a <em>Visitor Log</em> &mdash; date,
        name, company, escort, time in, time out.
      </P>

      <H3 id="pe-3">PE.L1-3.10.4 — Maintain audit logs of physical access</H3>
      <P>
        <strong>Plain English:</strong> The visitor log lives somewhere
        durable, and it&apos;s preserved. If the door has a badge reader,
        keep its logs too.
      </P>
      <P>
        <strong>Evidence:</strong> the visitor log itself, retained for at
        least 1 year, plus an export of badge-reader access events if
        applicable.
      </P>

      <H3 id="pe-4">PE.L1-3.10.5 — Control and manage physical access devices</H3>
      <P>
        <strong>Plain English:</strong> You know how many keys, badges, and
        door codes exist; you know who has each one; and you take them
        back when employees leave.
      </P>
      <P>
        <strong>Evidence:</strong> an <em>Access Device Register</em> with
        the issued/returned columns filled out.
      </P>

      {/* SC */}
      <H2 id="sc">System &amp; Communications Protection (SC) — 2 practices</H2>

      <H3 id="sc-1">SC.L1-3.13.1 — Monitor, control, and protect organizational communications at the boundaries</H3>
      <P>
        <strong>Plain English:</strong> You have a firewall (or a managed
        cloud equivalent) between your network and the internet, and
        you&apos;ve configured it. The default-deny rule is in place.
      </P>
      <P>
        <strong>Evidence:</strong> a <em>Network Boundary Inventory</em>
        listing each boundary device (router, firewall, VPN concentrator,
        cloud security group), the rule set, and the last review date.
      </P>

      <H3 id="sc-2">SC.L1-3.13.5 — Implement subnetworks for publicly accessible system components</H3>
      <P>
        <strong>Plain English:</strong> Anything that&apos;s on the public
        internet (your website, your customer portal) lives in a
        separate network segment from your internal systems. Classic
        DMZ pattern, or a public/private subnet split in AWS/Azure/GCP.
      </P>
      <P>
        <strong>Evidence:</strong> a network diagram &mdash; even a
        whiteboard photo &mdash; showing the public subnet separate from
        the private one, and the firewall rules that enforce the boundary.
      </P>

      {/* SI */}
      <H2 id="si">System &amp; Information Integrity (SI) — 4 practices</H2>

      <H3 id="si-1">SI.L1-3.14.1 — Identify, report, and correct system flaws in a timely manner</H3>
      <P>
        <strong>Plain English:</strong> You patch your stuff. Operating
        system updates, browser updates, server updates, on a regular
        cadence.
      </P>
      <P>
        <strong>Evidence:</strong> a <em>Patch Log</em> showing the last
        time each managed device was patched. Microsoft Intune, Jamf, and
        Google Endpoint Management all produce this directly.
      </P>

      <H3 id="si-2">SI.L1-3.14.2 — Provide protection from malicious code</H3>
      <P>
        <strong>Plain English:</strong> Anti-malware is installed and
        running on every endpoint where FCI is processed. Microsoft
        Defender for Endpoint, CrowdStrike, SentinelOne &mdash; pick one,
        use it, prove it.
      </P>
      <P>
        <strong>Evidence:</strong> an <em>Endpoint AV Inventory</em> &mdash;
        device, AV product, version, last-seen date, definitions date.
      </P>

      <H3 id="si-3">SI.L1-3.14.4 — Update malicious code protection mechanisms</H3>
      <P>
        <strong>Plain English:</strong> Definitions and engine versions
        are kept current. Automatic updates count.
      </P>
      <P>
        <strong>Evidence:</strong> the same inventory above, with the
        definitions date column actually populated and recent.
      </P>

      <H3 id="si-4">SI.L1-3.14.5 — Perform periodic and real-time scans</H3>
      <P>
        <strong>Plain English:</strong> Your AV runs both scheduled scans
        and real-time / on-access scanning. The default settings on
        Defender, CrowdStrike, etc. cover this; you just have to confirm
        nobody turned them off.
      </P>
      <P>
        <strong>Evidence:</strong> a screenshot of the scan policy showing
        both modes enabled, and a recent scan results export.
      </P>

      {/* Implement */}
      <H2 id="implement">How to actually implement these in a week</H2>
      <P>
        Most small contractors lose 80&ndash;120 hours of founder time
        attempting to interpret these practices, build the artifacts, and
        write the SSP. That&apos;s the consultant arbitrage:{" "}
        <Link
          href="/blog/cmmc-level-1-cost-diy-vs-consultant-vs-saas"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          $9,000&ndash;$30,000 in fees
        </Link>{" "}
        chasing what&apos;s ultimately a structured data-collection problem.
      </P>
      <P>
        The faster path is to start with the templates. Custodia&apos;s
        platform ships every roster and log in this article as a CSV you
        can fill in, walks you through each practice in plain English with
        prompts tailored to your tech stack (M365, Google Workspace, Okta,
        AWS), and auto-drafts your SSP narrative as you go. Most users
        complete a defensible package in 3&ndash;5 business days.
      </P>
      <Callout tone="ok" title="Free SPRS quiz">
        Not sure where you stand? The{" "}
        <Link
          href="/sprs-check"
          className="font-semibold underline underline-offset-2"
        >
          free Custodia SPRS quiz
        </Link>{" "}
        scores you against all 17 practices in about 4 minutes. No signup,
        no credit card &mdash; just an honest read on your gap.
      </Callout>

      <H2 id="faq">FAQ</H2>

      <H3>How is CMMC Level 1 different from Level 2?</H3>
      <P>
        Level 1 covers FCI and is a self-attestation. Level 2 covers CUI,
        requires NIST 800-171&apos;s 110 controls, and (for prioritized
        contracts) requires a third-party assessor.{" "}
        <Link
          href="/blog/far-vs-nist-vs-cmmc-level-1-vs-level-2-comparison"
          className="font-semibold text-[#1f5c47] underline underline-offset-2 hover:text-[#0e2a23]"
        >
          See the comparison.
        </Link>
      </P>

      <H3>Do I need a third-party assessor?</H3>
      <P>
        No. CMMC Level 1 is a self-assessment with annual self-affirmation
        in SPRS by a senior official.
      </P>

      <H3>What if I implement 16 of 17 practices?</H3>
      <P>
        Your SPRS affirmation has to be all 17 met or you&apos;re
        non-affirming. Level 1 is binary. There&apos;s no partial credit.
      </P>

      <H3>How often do I have to re-affirm?</H3>
      <P>
        Annually. Custodia members get the next cycle prepped automatically
        every October &mdash; no extra fee, no fire drill.
      </P>

      <Quote cite="The Custodia Compliance Team">
        Federal contractors who treat compliance as a one-week sprint
        plus a year-round watch always beat the ones who treat it as a
        consulting engagement.
      </Quote>
    </Prose>
  );
}

const post: BlogPost = { meta, Body };
export default post;
