import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manual Evidence Templates | Custodia",
  description:
    "Download Custodia's plain-English CSV templates for every CMMC Level 1 control that's easier to track in a spreadsheet.",
};

type TemplateRow = {
  slug: string;
  title: string;
  controls: string[];
  description: string;
};

const TEMPLATES: ReadonlyArray<TemplateRow> = [
  {
    slug: "authorized-users-roster",
    title: "Authorized Users Roster",
    controls: ["AC.L1-3.1.1"],
    description:
      "Who can log into your systems? One row per person + system, with a join / leave date.",
  },
  {
    slug: "role-matrix",
    title: "Role Matrix",
    controls: ["AC.L1-3.1.1", "AC.L1-3.1.2"],
    description:
      "What each role is allowed to do (read, write, admin) across email, file storage, and any system handling federal info.",
  },
  {
    slug: "access-device-register",
    title: "Access Device Register",
    controls: ["AC.L1-3.1.1", "IA.L1-3.5.1"],
    description:
      "Every laptop, phone, and badge that touches the business — assigned to a person, status tracked.",
  },
  {
    slug: "external-systems-inventory",
    title: "External Systems Inventory",
    controls: ["AC.L1-3.1.20"],
    description:
      "Every outside service (Dropbox, partner portal, personal Gmail) you use, and whether it's allowed to handle federal info.",
  },
  {
    slug: "public-posting-acknowledgement",
    title: "Public Posting Acknowledgement",
    controls: ["AC.L1-3.1.22"],
    description:
      "A short signed acknowledgement that public-posting reviewers understand they can't post federal-sensitive content.",
  },
  {
    slug: "endpoint-av-inventory",
    title: "Endpoint AV / Patch Inventory",
    controls: ["SI.L1-3.14.1", "SI.L1-3.14.2", "SI.L1-3.14.4"],
    description:
      "Every company laptop with antivirus status and last OS patch date. Built-in Windows Defender / macOS XProtect counts.",
  },
  {
    slug: "patch-log",
    title: "Patch Log",
    controls: ["SI.L1-3.14.1"],
    description:
      "When you patched what, and where you got the update from. Keep it skeletal — auto-updates are the gold standard.",
  },
  {
    slug: "media-disposal-log",
    title: "Media Disposal Log",
    controls: ["MP.L1-3.8.3"],
    description:
      "When a laptop, drive, or USB stick is wiped or destroyed. Receipt from a shredding service is enough.",
  },
  {
    slug: "physical-access-roster",
    title: "Physical Access Roster",
    controls: ["PE.L1-3.10.1"],
    description:
      "Who has keys, codes, or badges to your office. Home office? List who has the door key.",
  },
  {
    slug: "visitor-log",
    title: "Visitor Log",
    controls: ["PE.L1-3.10.3"],
    description:
      "Date, name, who they visited, time in / out. A clipboard at reception is fine.",
  },
  {
    slug: "network-boundary-inventory",
    title: "Network Boundary Inventory",
    controls: ["SC.L1-3.13.1", "SC.L1-3.13.5"],
    description:
      "Every network entry point and the firewall that fronts it. The router in your office is the answer for most small companies.",
  },
];

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            &larr; Back to Custodia
          </Link>
        </div>

        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          The manual path
        </div>
        <h1 className="mb-4 font-serif text-4xl text-slate-900">
          Compliance, your way.
        </h1>
        <p className="mb-8 text-lg text-slate-700">
          Don&apos;t want to wire up Microsoft 365 or Google Workspace? You
          don&apos;t have to. Every Custodia template below is a plain-English
          CSV your team can fill in once a year. Charlie reads them just the
          same as automated evidence.
        </p>

        <ul className="space-y-4">
          {TEMPLATES.map((t) => (
            <li
              key={t.slug}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t.controls.join(" · ")}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {t.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{t.description}</p>
                </div>
                <a
                  href={`/templates/${t.slug}.csv`}
                  download
                  className="flex-shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:border-emerald-500 hover:bg-emerald-50"
                >
                  Download CSV
                </a>
              </div>
            </li>
          ))}
        </ul>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white shadow-sm">
          <h2 className="mb-2 font-serif text-2xl">
            Or skip the spreadsheets entirely.
          </h2>
          <p className="mb-6 text-slate-300">
            Connect Microsoft 365 or Google Workspace and Charlie pulls the
            same evidence automatically — every quarter, forever. Manual is a
            backstop, not a chore.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            Start 14-day free trial
          </Link>
        </section>
      </div>
    </main>
  );
}
