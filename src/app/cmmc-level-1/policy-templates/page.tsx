import type { Metadata } from "next";
import Link from "next/link";
import { ResourceShell } from "../_components/ResourceShell";
import { ResourceCard } from "../_components/ResourceCard";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

const PAGE_URL = `${APP_URL}/cmmc-level-1/policy-templates`;

export const metadata: Metadata = {
  title:
    "Free CMMC Level 1 Policy Templates — 8 Plain-English Policies (Printable) | Custodia",
  description:
    "Eight free, fill-in-the-blank policy templates covering every CMMC Level 1 control family. Access control, identification, media, physical, network, integrity, incident response, acceptable use. Printable. No email required.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Free CMMC Level 1 Policy Templates (8 policies, printable)",
    description:
      "Eight one-page policies that cover every FAR 52.204-21 control family. Free, printable.",
    type: "article",
    url: PAGE_URL,
    siteName: "Custodia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free CMMC Level 1 Policy Templates",
    description:
      "Eight one-page policies. Plain English. Printable. No email required.",
  },
  robots: { index: true, follow: true },
};

const POLICIES: Array<{
  id: string;
  family: string;
  title: string;
  covers: string[];
  purpose: string;
  body: string[];
  responsibilities: string[];
}> = [
  {
    id: "01",
    family: "Access Control",
    title: "Access Control Policy",
    covers: ["AC.L1-3.1.1", "AC.L1-3.1.2", "AC.L1-3.1.20", "AC.L1-3.1.22"],
    purpose:
      "Define who can access company systems and information, and under what conditions.",
    body: [
      "Every user who accesses company systems must have a unique, named account. Shared accounts are prohibited.",
      "User accounts are created only after written approval by the system owner or their designee, and are tied to a specific person and role.",
      "Permissions follow the principle of least privilege: each user receives only the access required for their assigned duties. Administrative privileges are restricted to designated administrators.",
      "External system connections (third-party cloud services, vendor portals, contractor laptops) are approved in writing by the system owner before use. A list of approved external services is maintained.",
      "Federal contract information is not posted to public-facing channels (website, social media, marketing materials, conference talks) without written approval from the system owner.",
      "User accounts are disabled within one business day of role change or separation.",
    ],
    responsibilities: [
      "System owner: approves new accounts and access changes",
      "All employees: follow this policy and do not share accounts",
      "IT contact: implements approvals, disables accounts on separation",
    ],
  },
  {
    id: "02",
    family: "Identification & Authentication",
    title: "Identification &amp; Authentication Policy",
    covers: ["IA.L1-3.5.1", "IA.L1-3.5.2"],
    purpose:
      "Verify the identity of users and devices before granting access.",
    body: [
      "Every user is identified by a unique username tied to their legal name.",
      "All company-owned devices are inventoried, named, and associated with an assigned user.",
      "Passwords must be at least 12 characters, contain a mix of letters and numbers, and may not be reused from another service.",
      "Multi-factor authentication is required on email, all cloud applications used for company work, and any remote access (VPN, RDP, SSH).",
      "Default passwords on any new system or device must be changed before that system is used for company work.",
      "Authentication credentials are never stored in plain text or shared via email, chat, or paper.",
    ],
    responsibilities: [
      "IT contact: enforces password and MFA configuration",
      "All employees: enroll in MFA, do not share credentials",
      "System owner: reviews compliance quarterly",
    ],
  },
  {
    id: "03",
    family: "Media Protection",
    title: "Media Protection &amp; Disposal Policy",
    covers: ["MP.L1-3.8.3"],
    purpose:
      "Ensure information is not recoverable from media that leaves company control.",
    body: [
      "Any physical or digital media that has held federal contract information is sanitized before disposal, reuse, or release.",
      "Acceptable sanitization methods: full-disk wipe for drives, factory reset for phones and tablets, physical destruction (shredding) for paper and damaged drives.",
      "A media disposal log is maintained recording: date, item description, sanitization method, person performing the action, and witness (if applicable).",
      "Disposal log entries are retained for a minimum of three years.",
      "Media awaiting destruction is kept in a locked area until processed.",
    ],
    responsibilities: [
      "IT contact: performs sanitization, signs the log",
      "All employees: hand over devices/media; do not take them home or discard them",
      "System owner: audits the disposal log annually",
    ],
  },
  {
    id: "04",
    family: "Physical Protection",
    title: "Physical Protection Policy",
    covers: [
      "PE.L1-3.10.1",
      "PE.L1-3.10.3",
      "PE.L1-3.10.4",
      "PE.L1-3.10.5",
    ],
    purpose:
      "Limit physical access to areas where federal contract work is performed.",
    body: [
      "The designated work area is secured by lock at the end of every business day and during any period it is unattended.",
      "Only authorized employees and approved contractors may enter the work area unescorted.",
      "All visitors (clients, vendors, family members, delivery personnel, prospective hires) are escorted by an employee from arrival to departure and must sign the visitor log.",
      "The visitor log records: visitor name, organization, host employee, time in, time out. The log is retained for one year minimum.",
      "Physical access devices (keys, badges, fobs, alarm codes) are issued by the system owner and tracked in a register. Devices are collected within one business day of employee separation, and codes are changed when group access changes.",
    ],
    responsibilities: [
      "System owner: issues and revokes access devices, maintains the register",
      "All employees: lock up, escort visitors, log entries",
      "Office manager: maintains the visitor log",
    ],
  },
  {
    id: "05",
    family: "System & Communications",
    title: "Network &amp; Boundary Protection Policy",
    covers: ["SC.L1-3.13.1", "SC.L1-3.13.5"],
    purpose:
      "Defend the network boundary between company systems and the public internet.",
    body: [
      "A firewall (appliance or cloud) protects every internet-facing system. The firewall is configured to deny inbound traffic by default and allow outbound traffic only as needed.",
      "Firewall configuration is reviewed at least annually and after any significant change.",
      "Guest Wi-Fi is logically separated from the internal work network. Guest devices cannot reach internal devices or shared storage.",
      "Public-facing systems (marketing website, contact forms) are hosted separately from internal work systems and do not have direct access to FCI.",
      "Remote access is permitted only through approved methods: VPN with MFA, or an SSO-controlled cloud application.",
    ],
    responsibilities: [
      "IT contact: maintains firewall configuration, performs reviews",
      "All employees: connect to the work network, not guest, for work",
      "System owner: approves changes to network architecture",
    ],
  },
  {
    id: "06",
    family: "System & Information Integrity",
    title: "System Integrity &amp; Patching Policy",
    covers: [
      "SI.L1-3.14.1",
      "SI.L1-3.14.2",
      "SI.L1-3.14.4",
      "SI.L1-3.14.5",
    ],
    purpose:
      "Keep systems patched, protected from malware, and monitored.",
    body: [
      "Operating systems and applications on all in-scope devices are configured to install security updates automatically. Critical patches are installed within 14 days; high-priority within 30 days.",
      "Antivirus / endpoint protection is installed and enabled on every in-scope device. Built-in Windows Defender or macOS endpoint security is acceptable when properly configured.",
      "Antivirus signatures are updated automatically. Signature freshness is verified at least monthly.",
      "A full-system scan is run on every in-scope device at least weekly. Real-time scanning is enabled by default.",
      "Patch status and antivirus status are documented quarterly.",
    ],
    responsibilities: [
      "IT contact: verifies patch status, AV status, scan logs quarterly",
      "All employees: reboot when prompted, do not disable AV",
      "System owner: reviews quarterly status reports",
    ],
  },
  {
    id: "07",
    family: "Incident Response",
    title: "Incident Response Policy",
    covers: ["Supports overall L1 hygiene"],
    purpose:
      "Detect, contain, and report cyber incidents involving company systems.",
    body: [
      "A cyber incident includes: malware infection, unauthorized access to systems or data, lost or stolen devices, suspected phishing compromise, or any event suspected to compromise federal contract information.",
      "Any employee who suspects an incident must notify the system owner immediately, by any available means.",
      "On notification, the system owner: contains the affected device (disconnect from network), preserves evidence, and notifies senior management.",
      "If federal contract information may be involved, the company evaluates obligations under any applicable contract clauses (e.g., DFARS 252.204-7012 requires 72-hour reporting to DC3 if CUI is involved).",
      "An incident record is maintained including: detection time, scope, actions taken, root cause, and lessons learned. Records are retained for three years.",
    ],
    responsibilities: [
      "All employees: report immediately",
      "System owner: leads containment and reporting",
      "Senior management: notifies the prime / agency as required",
    ],
  },
  {
    id: "08",
    family: "Acceptable Use",
    title: "Acceptable Use Policy",
    covers: ["Supports access control, IA, SC, SI"],
    purpose:
      "Set expectations for how employees use company systems and information.",
    body: [
      "Company systems and accounts are for company business. Limited personal use is permitted if it does not interfere with work or violate this policy.",
      "Federal contract information is not stored on personal devices, personal cloud accounts, or personal email.",
      "Employees do not download unapproved software to in-scope devices.",
      "Employees do not connect personal USB drives or external storage to in-scope devices without approval.",
      "Suspected phishing emails are reported to the system owner and not forwarded or clicked.",
      "Devices are locked when unattended.",
    ],
    responsibilities: [
      "All employees: acknowledge in writing at hire and annually",
      "System owner: maintains signed acknowledgments",
    ],
  },
];

const Sig = () => (
  <div className="mt-8 grid gap-x-10 gap-y-7 md:grid-cols-2 print-avoid-break">
    <div>
      <div className="h-10 border-b border-[#10231d]" />
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
        Approved by (name &amp; title)
      </div>
    </div>
    <div>
      <div className="h-10 border-b border-[#10231d]" />
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
        Date &middot; Next review (12 months)
      </div>
    </div>
  </div>
);

export default function PolicyTemplatesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Free CMMC Level 1 Policy Templates — 8 Plain-English Policies",
    description:
      "Eight free, fill-in-the-blank policy templates covering every CMMC Level 1 control family.",
    url: PAGE_URL,
    mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
    author: { "@type": "Organization", name: "Custodia", url: APP_URL },
    publisher: {
      "@type": "Organization",
      name: "Custodia",
      url: APP_URL,
      logo: { "@type": "ImageObject", url: `${APP_URL}/custodia-logo.png` },
    },
    datePublished: "2026-05-13",
    dateModified: "2026-05-13",
    isAccessibleForFree: true,
  };

  return (
    <ResourceShell title="policy pack">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResourceCard
        eyebrow="Custodia · Free policy pack · 2026 edition"
        title="The CMMC Level 1"
        italic="policy pack"
        trailing="— 8 policies."
        subtitle={
          <>
            Eight one-page policies that cover every CMMC Level 1
            control family. Fill in your company name, sign, and file.
            Annually review.
          </>
        }
        stats={[
          { n: "8", l: "Policies, one page each" },
          { n: "~45 min", l: "To complete" },
          { n: "100%", l: "FAR 52.204-21 coverage" },
        ]}
      >
        {/* How to use */}
        <section className="print-avoid-break">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            How to use this pack
          </h2>
          <ol className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#10231d]">
            <li>
              <strong>1.</strong> Read each policy, edit anything that
              genuinely doesn&apos;t fit your business.
            </li>
            <li>
              <strong>2.</strong> Fill in the &ldquo;approved by&rdquo;
              line. The person approving should have authority to bind
              the company.
            </li>
            <li>
              <strong>3.</strong> Date it. Schedule annual review.
            </li>
            <li>
              <strong>4.</strong> Keep the signed copies with your SSP
              and self-assessment. They&apos;re evidence.
            </li>
          </ol>
        </section>

        {/* Each policy on its own printed page */}
        {POLICIES.map((p) => (
          <section
            key={p.id}
            className="print-page-break mt-12"
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
              Policy {p.id} &middot; {p.family}
            </div>
            <h2
              className="mt-2 font-serif text-[26px] font-bold leading-tight text-[#10231d]"
              dangerouslySetInnerHTML={{ __html: p.title }}
            />

            <div className="mt-5 grid gap-4 border-y border-[#cfe3d9] py-4 text-[12px] md:grid-cols-2">
              <div>
                <div className="font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                  Covers
                </div>
                <div className="mt-1 font-mono text-[#2f8f6d]">
                  {p.covers.join(" · ")}
                </div>
              </div>
              <div>
                <div className="font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
                  Purpose
                </div>
                <div className="mt-1 text-[#10231d]">{p.purpose}</div>
              </div>
            </div>

            <h3 className="mt-7 font-serif text-lg font-bold text-[#10231d]">
              Policy
            </h3>
            <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[14px] leading-relaxed text-[#10231d]">
              {p.body.map((para, i) => (
                <li key={i}>{para}</li>
              ))}
            </ol>

            <h3 className="mt-6 font-serif text-lg font-bold text-[#10231d]">
              Responsibilities
            </h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-[#10231d]">
              {p.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>

            <Sig />
          </section>
        ))}

        <footer className="mt-14 border-t border-[#cfe3d9] pt-6 text-center text-[10px] uppercase tracking-[0.24em] text-[#5a7d70]">
          Custodia &middot; bidfedcmmc.com &middot; Built from{" "}
          <span className="text-[#2f8f6d]">FAR 52.204-21</span>{" "}
          &middot; Not legal advice
        </footer>

        <div className="no-print mt-12 border-t border-[#cfe3d9] pt-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
            Pair with
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link
              href="/cmmc-level-1/ssp-template"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">SSP template &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Your SSP will reference these policies by name.
              </div>
            </Link>
            <Link
              href="/cmmc-level-1/scoping-worksheet"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">Scoping worksheet &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Define the boundary the policies apply to.
              </div>
            </Link>
            <Link
              href="/cmmc-level-1/checklist"
              className="block border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-sm text-[#10231d] hover:border-[#2f8f6d]"
            >
              <div className="font-bold">Self-assessment checklist &rarr;</div>
              <div className="mt-1 text-[12px] text-[#5a7d70]">
                Score yourself against the 15 requirements.
              </div>
            </Link>
          </div>
        </div>
      </ResourceCard>
    </ResourceShell>
  );
}
