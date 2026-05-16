import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDbReady, getSql } from "@/lib/db";
import { setAsideLabels, type SetAside } from "@/lib/bid-profile";
import { loadBidProfile } from "@/lib/bid-profile-server";
import { tryDecryptField } from "@/lib/security/field-encryption";

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
  const row = rows[0] ?? null;
  if (!row) return null;
  // Tier 1: signer title is encrypted at rest. Decrypt for the public trust
  // page; legacy plaintext rows pass through unchanged.
  return {
    ...row,
    affirmed_by_title: await tryDecryptField(row.affirmed_by_title, {
      organizationId: row.organization_id,
      field: "assessments.affirmed_by_title",
    }),
  };
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
    <main className="min-h-screen bg-[#f5f8f6] text-[#10231d]">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Custodia top bar */}
      <header className="bg-[#0a1814] text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/custodia-logo.png"
              alt="Custodia"
              className="h-8 w-auto"
            />
            <span className="font-serif text-xl font-bold tracking-tight">
              Custodia<span className="text-[#f59e0b]">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#cfe3d9]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#f59e0b]"
              aria-hidden
            />
            Custodia Verified
          </div>
        </div>
      </header>

      {/* Hero band */}
      <section className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#2f8f6d]">
                CMMC Level 1 · Self-attested · Continuously monitored
              </div>
              <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
                {page.organization_name}
                {page.entity_type ? (
                  <span className="ml-2 align-middle font-sans text-base font-normal text-[#5a7d70]">
                    ({page.entity_type})
                  </span>
                ) : null}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#3d5950]">
                This page is a live attestation that{" "}
                <strong className="text-[#10231d]">
                  {page.organization_name}
                </strong>{" "}
                implements all 15 FAR 52.204-21 basic safeguarding requirements
                and is monitored continuously on the Custodia platform.
              </p>
            </div>
            <div
              className={`inline-flex shrink-0 items-center gap-2 border px-4 py-2 text-sm font-bold uppercase tracking-wider ${HEALTH_PILL[health]}`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_DOT_BG[health]}`}
                aria-hidden
              />
              {HEALTH_LABELS[health]}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
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
                      <li key={s} className="text-sm text-[#10231d]">
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
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#2f8f6d] underline-offset-4 hover:underline"
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
              value={`${page.status_practices_met ?? 15} / ${page.status_practices_total ?? 15}`}
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
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#2f8f6d] underline-offset-4 hover:underline"
                >
                  Verify SPRS filing by UEI →
                </a>
              </div>
            ) : null}
          </Card>
        </section>

        {/* Continuous monitoring */}
        {page.show_continuous_monitoring ? (
          <section className="mb-6 border-l-4 border-[#2f8f6d] bg-white p-6 shadow-sm ring-1 ring-[#cfe3d9]">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                  Live signal
                </div>
                <h2 className="mt-1 font-serif text-2xl font-bold text-[#10231d]">
                  Continuous monitoring
                </h2>
              </div>
              <p className="text-xs text-[#5a7d70]">
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
              <p className={`mt-5 border px-3 py-2 text-sm ${HEALTH_PILL[health]}`}>
                {page.status_health_reason}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* About */}
        {page.custom_about ? (
          <section className="mb-6 border-l-4 border-[#f59e0b] bg-white p-6 shadow-sm ring-1 ring-[#cfe3d9]">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
              About this contractor
            </div>
            <h2 className="mb-2 mt-1 font-serif text-2xl font-bold text-[#10231d]">
              About
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#3d5950]">
              {page.custom_about}
            </p>
          </section>
        ) : null}

        {/* What this page is */}
        <section className="mb-6 bg-[#10231d] p-6 text-white shadow-sm sm:p-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#f59e0b]">
            For contracting officers and primes
          </div>
          <h2 className="mb-3 mt-1 font-serif text-2xl font-bold">
            How to read this page
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-[#cfe3d9]">
            This page is published by {page.organization_name} via Custodia, a
            cybersecurity firm based in Pittsburgh, PA. Custodia attests that
            this organization has implemented all 15 FAR 52.204-21 basic
            safeguarding requirements on the Custodia platform and that the
            SPRS posting referenced was filed by an authenticated user of
            the platform on the date shown.
          </p>
          <p className="mb-3 text-sm leading-relaxed text-[#cfe3d9]">
            CMMC Level 1 is annual self-attestation under FAR 52.204-21 and 32
            CFR Part 170 — there is no third-party certification at Level 1.
            The authoritative federal record is the SPRS filing, which any
            contracting officer can independently verify by UEI. Custodia does
            not warrant the accuracy of the underlying self-attestation, which
            is the legal responsibility of the organization&rsquo;s Senior
            Official under 32 CFR § 170.22.
          </p>
          <div className="mt-4 grid gap-2 border-t border-[#1f4036] pt-4 text-sm text-[#cfe3d9] sm:grid-cols-2">
            <p>
              <strong className="text-[#2f8f6d]">Healthy</strong> — active
              monitoring, no drift, evidence fresh.
            </p>
            <p>
              <strong className="text-[#f59e0b]">Drift detected</strong> — a
              control signal changed and Custodia is investigating.
            </p>
            <p>
              <strong className="text-[#ff6b6b]">Action required</strong> —
              the affirmation has lapsed or a critical drift event is
              unresolved.
            </p>
            <p>
              <strong className="text-[#cfe3d9]">Status pending</strong> —
              first health snapshot has not yet been computed.
            </p>
          </div>
        </section>

        {/* Contact + verify integrity */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <Card title="Contact" subtitle="Capability statement, NDA, or evidence pack">
            {page.contact_email ? (
              <p className="text-sm text-[#3d5950]">
                <a
                  href={`mailto:${page.contact_email}`}
                  className="font-bold text-[#2f8f6d] underline-offset-4 hover:underline"
                >
                  {page.contact_email}
                </a>
              </p>
            ) : (
              <p className="text-sm text-[#3d5950]">
                Contact this organization through their website or SAM.gov
                profile.
              </p>
            )}
          </Card>
          <Card title="Page integrity" subtitle="Report a concern">
            <p className="text-sm text-[#3d5950]">
              Spotted something inaccurate? Email{" "}
              <a
                href="mailto:integrity@custodia.dev"
                className="font-bold text-[#2f8f6d] underline-offset-4 hover:underline"
              >
                integrity@custodia.dev
              </a>{" "}
              and include this page&rsquo;s Custodia ID. Custodia reviews all
              integrity reports within one business day.
            </p>
          </Card>
        </section>

        {/* CTA footer */}
        <div className="relative overflow-hidden bg-[#0a1814] p-8 text-center text-white shadow-sm sm:p-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#f59e0b]">
            Custodia
          </div>
          <p className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
            Want this page for your company?
          </p>
          <p className="mt-2 text-sm text-[#cfe3d9]">
            CMMC Level 1, signed, filed in SPRS, and continuously monitored —
            built for small federal contractors.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sprs-check"
              className="inline-flex items-center bg-[#f59e0b] px-5 py-3 text-sm font-bold uppercase tracking-wider text-[#0a1814] transition-colors hover:bg-[#fbb83b]"
            >
              Take the free SPRS quiz →
            </Link>
            <Link
              href="/"
              className="inline-flex items-center border border-[#cfe3d9]/40 px-5 py-3 text-sm font-bold uppercase tracking-wider text-[#cfe3d9] transition-colors hover:bg-[#10231d]"
            >
              How Custodia works
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[#5a7d70]">
          Custodia · Pittsburgh, PA · Published{" "}
          {fmtDate(page.published_at)} · Last updated{" "}
          {fmtDate(page.updated_at)} · Custodia ID{" "}
          <span className="font-mono font-semibold text-[#10231d]">
            {page.custodia_verification_id}
          </span>
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
    <div className="border-l-4 border-[#10231d] bg-white p-6 shadow-sm ring-1 ring-[#cfe3d9]">
      <h2 className="font-serif text-lg font-bold text-[#10231d]">{title}</h2>
      {subtitle ? (
        <p className="mb-4 mt-0.5 text-xs text-[#5a7d70]">{subtitle}</p>
      ) : (
        <div className="mb-4" />
      )}
      <dl className="space-y-2.5">{children}</dl>
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
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
        {label}
      </dt>
      <dd
        className={`text-[#10231d] ${mono ? "font-mono text-sm font-semibold" : ""}`}
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
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a7d70]">
        {label}
      </dt>
      <dd className="flex items-center gap-2 text-[#10231d]">
        <span
          className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-[#2f8f6d]" : "bg-[#cfe3d9]"}`}
          aria-hidden
        />
        {connected ? `Connected · synced ${fmtRelative(lastSyncAt)}` : "Not connected"}
      </dd>
    </div>
  );
}
