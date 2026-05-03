import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDbReady, getSql } from "@/lib/db";
import { setAsideLabels, type SetAside, loadBidProfile } from "@/lib/bid-profile";

export const revalidate = 300; // 5min ISR — short enough to feel live

type VerifiedPageRow = {
  organization_id: string;
  organization_name: string;
  entity_type: string | null;
  sam_uei: string | null;
  cage_code: string | null;
  naics_codes: string[];
  verification_slug: string;
  custodia_verification_id: string | null;
  is_public: boolean;
  custom_about: string | null;
  contact_email: string | null;
  show_continuous_monitoring: boolean;
  show_connectors: boolean;
  show_sprs_link: boolean;
  show_set_asides: boolean;
  published_at: string | null;
  updated_at: string;
  // From assessments
  fiscal_year: number | null;
  sprs_filed_at: string | null;
  affirmation_signed_at: string | null;
  affirmed_by_title: string | null;
  // From trust_status (may be null if not computed yet)
  status_health: "green" | "amber" | "red" | "gray" | null;
  status_health_reason: string | null;
  status_practices_met: number | null;
  status_practices_total: number | null;
  status_evidence_count: number | null;
  status_oldest_evidence_age_days: number | null;
  status_newest_evidence_age_days: number | null;
  status_m365_last_sync_at: string | null;
  status_google_last_sync_at: string | null;
  status_open_drift_count: number | null;
  status_last_computed_at: string | null;
  status_next_reaffirm_due: string | null;
};

async function loadVerifiedPage(slug: string): Promise<VerifiedPageRow | null> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      t.organization_id,
      o.name AS organization_name,
      o.entity_type,
      o.sam_uei,
      o.cage_code,
      o.naics_codes,
      t.verification_slug,
      t.custodia_verification_id,
      t.is_public,
      t.custom_about,
      t.contact_email,
      t.show_continuous_monitoring,
      t.show_connectors,
      t.show_sprs_link,
      t.show_set_asides,
      t.published_at,
      t.updated_at,
      latest.fiscal_year,
      latest.sprs_filed_at,
      latest.affirmation_signed_at,
      latest.affirmed_by_title,
      ts.health AS status_health,
      ts.health_reason AS status_health_reason,
      ts.practices_met AS status_practices_met,
      ts.practices_total AS status_practices_total,
      ts.evidence_count AS status_evidence_count,
      ts.oldest_evidence_age_days AS status_oldest_evidence_age_days,
      ts.newest_evidence_age_days AS status_newest_evidence_age_days,
      ts.m365_last_sync_at AS status_m365_last_sync_at,
      ts.google_last_sync_at AS status_google_last_sync_at,
      ts.open_drift_count AS status_open_drift_count,
      ts.last_computed_at AS status_last_computed_at,
      ts.next_reaffirm_due AS status_next_reaffirm_due
    FROM trust_pages t
    JOIN organizations o ON o.id = t.organization_id
    LEFT JOIN LATERAL (
      SELECT a.fiscal_year,
             a.sprs_filed_at,
             a.affirmed_at AS affirmation_signed_at,
             a.affirmed_by_title
      FROM assessments a
      WHERE a.organization_id = t.organization_id
        AND a.sprs_filed_at IS NOT NULL
      ORDER BY a.sprs_filed_at DESC
      LIMIT 1
    ) latest ON TRUE
    LEFT JOIN trust_status ts ON ts.organization_id = t.organization_id
    WHERE (t.verification_slug = ${slug} OR t.slug = ${slug})
      AND t.is_public = TRUE
    LIMIT 1
  `) as VerifiedPageRow[];
  return rows[0] ?? null;
}

export async function generateMetadata(
  props: PageProps<"/verified/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await loadVerifiedPage(slug).catch(() => null);
  if (!page) {
    return { title: "Verified page not found", robots: { index: false } };
  }
  const title = `${page.organization_name} — Custodia Verified`;
  const description = `${page.organization_name} maintains an active CMMC Level 1 self-assessment under FAR 52.204-21, continuously monitored by Custodia. Custodia ID ${page.custodia_verification_id ?? ""}.`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Custodia Verified",
    },
  };
}

const HEALTH_LABELS: Record<"green" | "amber" | "red" | "gray", string> = {
  green: "Healthy",
  amber: "Drift detected",
  red: "Action required",
  gray: "Status pending",
};

const HEALTH_DOT_BG: Record<"green" | "amber" | "red" | "gray", string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-slate-400",
};

const HEALTH_PILL: Record<"green" | "amber" | "red" | "gray", string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-900",
  amber: "border-amber-300 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-900",
  gray: "border-slate-300 bg-slate-50 text-slate-700",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const ms = now - then;
  if (ms < 0) return "in the future";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default async function VerifiedPublicPage(
  props: PageProps<"/verified/[slug]">,
) {
  const { slug } = await props.params;
  const page = await loadVerifiedPage(slug);
  if (!page) notFound();

  const health = page.status_health ?? "gray";
  const setAsides: SetAside[] = page.show_set_asides
    ? await loadBidProfile(page.organization_id)
        .then((p) => p.set_asides)
        .catch(() => [] as SetAside[])
    : [];

  const samVerifyUrl = page.sam_uei
    ? `https://sam.gov/entity/${encodeURIComponent(page.sam_uei)}`
    : null;
  const sprsVerifyUrl =
    page.show_sprs_link && page.sam_uei ? "https://piee.eb.mil" : null;

  const lastComputed = page.status_last_computed_at;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
  ).replace(/\/$/, "");
  const canonicalUrl = `${appUrl}/verified/${page.verification_slug ?? slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: page.organization_name,
    url: canonicalUrl,
    identifier: [
      page.custodia_verification_id
        ? {
            "@type": "PropertyValue",
            propertyID: "Custodia Verification ID",
            value: page.custodia_verification_id,
          }
        : null,
      page.sam_uei
        ? {
            "@type": "PropertyValue",
            propertyID: "UEI",
            value: page.sam_uei,
          }
        : null,
      page.cage_code
        ? {
            "@type": "PropertyValue",
            propertyID: "CAGE",
            value: page.cage_code,
          }
        : null,
    ].filter(Boolean),
    hasCredential: page.sprs_filed_at
      ? {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "CMMC Level 1 Self-Attestation",
          recognizedBy: {
            "@type": "GovernmentOrganization",
            name: "U.S. Department of Defense (FAR 52.204-21 / SPRS)",
          },
          dateCreated: page.sprs_filed_at,
          validFor: "P1Y",
        }
      : undefined,
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Custodia Verified
            </div>
            <h1 className="mt-2 font-serif text-4xl text-slate-900">
              {page.organization_name}
              {page.entity_type ? (
                <span className="ml-2 align-middle text-base font-normal text-slate-500">
                  ({page.entity_type})
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-base text-slate-600">
              CMMC Level 1 self-attested · Continuously monitored by Custodia
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${HEALTH_PILL[health]}`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${HEALTH_DOT_BG[health]}`}
              aria-hidden
            />
            {HEALTH_LABELS[health]}
          </div>
        </div>

        {/* Two-column: Federal record + Compliance status */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <Card title="Federal record" subtitle="Public registry data">
            <DefRow label="Custodia ID" value={page.custodia_verification_id ?? "—"} mono />
            <DefRow label="UEI (SAM.gov)" value={page.sam_uei ?? "—"} mono />
            <DefRow label="CAGE code" value={page.cage_code ?? "—"} mono />
            <DefRow
              label="NAICS codes"
              value={
                page.naics_codes && page.naics_codes.length > 0
                  ? page.naics_codes.join(", ")
                  : "—"
              }
            />
            {page.show_set_asides && setAsides.length > 0 ? (
              <DefRow
                label="Set-asides"
                value={
                  <ul className="space-y-1">
                    {setAsides.map((s) => (
                      <li key={s} className="text-sm text-slate-900">
                        {setAsideLabels[s]}
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : null}
            {samVerifyUrl ? (
              <div className="mt-3">
                <a
                  href={samVerifyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline hover:text-emerald-800"
                >
                  Verify on SAM.gov →
                </a>
              </div>
            ) : null}
          </Card>

          <Card title="Compliance status" subtitle="CMMC Level 1 · FAR 52.204-21">
            <DefRow label="Framework" value="CMMC Level 1 · FAR 52.204-21" />
            <DefRow
              label="Practices met"
              value={`${page.status_practices_met ?? 17} / ${page.status_practices_total ?? 17}`}
            />
            <DefRow
              label="Affirmation signed"
              value={fmtDate(page.affirmation_signed_at)}
            />
            <DefRow
              label="Filed in SPRS"
              value={fmtDate(page.sprs_filed_at)}
            />
            <DefRow
              label={`Fiscal year`}
              value={page.fiscal_year ? `FY${page.fiscal_year}` : "—"}
            />
            <DefRow
              label="Next re-affirmation"
              value={fmtDate(page.status_next_reaffirm_due)}
            />
            {sprsVerifyUrl ? (
              <div className="mt-3">
                <a
                  href={sprsVerifyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline hover:text-emerald-800"
                >
                  Verify SPRS filing by UEI →
                </a>
              </div>
            ) : null}
          </Card>
        </section>

        {/* Continuous monitoring */}
        {page.show_continuous_monitoring ? (
          <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl text-slate-900">
                Continuous monitoring
              </h2>
              <p className="text-xs text-slate-500">
                Last health check: {fmtRelative(lastComputed)}
                {lastComputed ? ` (${fmtDate(lastComputed)})` : ""}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {page.show_connectors ? (
                <>
                  <ConnectorRow
                    label="Microsoft 365"
                    lastSyncAt={page.status_m365_last_sync_at}
                  />
                  <ConnectorRow
                    label="Google Workspace"
                    lastSyncAt={page.status_google_last_sync_at}
                  />
                </>
              ) : null}
              <DefRow
                label="Evidence freshness"
                value={
                  page.status_evidence_count != null
                    ? `${page.status_evidence_count} artifacts · oldest ${page.status_oldest_evidence_age_days ?? "—"}d, newest ${page.status_newest_evidence_age_days ?? "—"}d`
                    : "Snapshot pending first sync"
                }
              />
              <DefRow
                label="Open drift events"
                value={
                  page.status_open_drift_count == null
                    ? "—"
                    : page.status_open_drift_count === 0
                      ? "None"
                      : `${page.status_open_drift_count} open`
                }
              />
            </div>
            {page.status_health_reason ? (
              <p className={`mt-4  border px-3 py-2 text-sm ${HEALTH_PILL[health]}`}>
                {page.status_health_reason}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* About */}
        {page.custom_about ? (
          <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-serif text-xl text-slate-900">About</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {page.custom_about}
            </p>
          </section>
        ) : null}

        {/* What this page is */}
        <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-serif text-xl text-slate-900">
            How to read this page
          </h2>
          <p className="mb-2 text-sm text-slate-700">
            This page is published by {page.organization_name} via Custodia, a
            cybersecurity firm based in Pittsburgh, PA. Custodia attests that
            this organization has implemented all 17 FAR 52.204-21 practices
            on the Custodia platform and that the SPRS confirmation
            referenced was filed by an authenticated user of the platform on
            the date shown.
          </p>
          <p className="mb-2 text-sm text-slate-700">
            CMMC Level 1 is annual self-attestation under FAR 52.204-21 and
            32 CFR Part 170 — there is no third-party certification at Level
            1. The authoritative federal record is the SPRS filing, which any
            contracting officer can independently verify by UEI. Custodia
            does not warrant the accuracy of the underlying self-attestation,
            which is the legal responsibility of the organization&rsquo;s
            Senior Official under 32 CFR § 170.22.
          </p>
          <p className="text-sm text-slate-700">
            <strong>Health states:</strong>{" "}
            <em className="text-emerald-700">Healthy</em> = active monitoring,
            no drift, evidence fresh.{" "}
            <em className="text-amber-700">Drift detected</em> = a control
            signal changed and Custodia is investigating.{" "}
            <em className="text-red-700">Action required</em> = the
            affirmation has lapsed or a critical drift event is unresolved.{" "}
            <em className="text-slate-600">Status pending</em> = first health
            snapshot has not yet been computed.
          </p>
        </section>

        {/* Contact + verify integrity */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <Card title="Contact" subtitle="Reach out for capability statement, NDA, or evidence pack">
            {page.contact_email ? (
              <p className="text-sm text-slate-700">
                <a
                  href={`mailto:${page.contact_email}`}
                  className="font-semibold text-emerald-700 underline hover:text-emerald-800"
                >
                  {page.contact_email}
                </a>
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                Contact this organization through their website or SAM.gov
                profile.
              </p>
            )}
          </Card>
          <Card title="Page integrity" subtitle="Report a concern">
            <p className="text-sm text-slate-700">
              Spotted something inaccurate? Email{" "}
              <a
                href="mailto:integrity@custodia.dev"
                className="font-semibold text-emerald-700 underline hover:text-emerald-800"
              >
                integrity@custodia.dev
              </a>{" "}
              and include this page&rsquo;s Custodia ID. Custodia reviews all
              integrity reports within one business day.
            </p>
          </Card>
        </section>

        {/* Footer */}
        <div className="mt-8  border border-slate-200 bg-slate-900 p-6 text-center text-white shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
            Custodia
          </div>
          <p className="text-sm text-slate-300">
            Want this for your company?{" "}
            <Link
              href="/sprs-check"
              className="font-semibold text-amber-300 underline hover:text-amber-200"
            >
              Take the free SPRS quiz
            </Link>
            .
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Custodia · Pittsburgh, PA · Published{" "}
          {fmtDate(page.published_at)} · Last updated{" "}
          {fmtDate(page.updated_at)} · Custodia ID{" "}
          <span className="font-mono">{page.custodia_verification_id}</span>
        </p>
      </div>
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className=" border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-lg text-slate-900">{title}</h2>
      {subtitle ? (
        <p className="mb-3 mt-0.5 text-xs text-slate-500">{subtitle}</p>
      ) : (
        <div className="mb-3" />
      )}
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function DefRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        className={`text-slate-900 ${mono ? "font-mono text-sm font-semibold" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ConnectorRow({
  label,
  lastSyncAt,
}: {
  label: string;
  lastSyncAt: string | null;
}) {
  const connected = !!lastSyncAt;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="flex items-center gap-2 text-slate-900">
        <span
          className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`}
          aria-hidden
        />
        {connected ? `Connected · synced ${fmtRelative(lastSyncAt)}` : "Not connected"}
      </dd>
    </div>
  );
}
