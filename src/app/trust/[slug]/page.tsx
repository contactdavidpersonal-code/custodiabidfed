import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureDbReady, getSql } from "@/lib/db";

export const revalidate = 3600; // 1 hour ISR

type TrustPageRow = {
  organization_id: string;
  slug: string;
  is_public: boolean;
  headline: string | null;
  summary: string | null;
  contact_email: string | null;
  fields: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
  organization_name: string;
  attestation_signed_at: string | null;
};

async function loadTrustPage(slug: string): Promise<TrustPageRow | null> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT t.organization_id, t.slug, t.is_public, t.headline, t.summary,
           t.contact_email, t.fields, t.published_at, t.updated_at,
           o.name AS organization_name,
           (
             SELECT MAX(a.affirmed_at)
             FROM assessments a
             WHERE a.organization_id = t.organization_id
               AND a.affirmed_at IS NOT NULL
           ) AS attestation_signed_at
    FROM trust_pages t
    JOIN organizations o ON o.id = t.organization_id
    WHERE t.slug = ${slug}
      AND t.is_public = TRUE
    LIMIT 1
  `) as TrustPageRow[];
  return rows[0] ?? null;
}

export async function generateMetadata(
  props: PageProps<"/trust/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await loadTrustPage(slug).catch(() => null);
  if (!page) return { title: "Trust page not found", robots: { index: false } };
  return {
    title: `${page.organization_name} — Trust & Compliance | Custodia`,
    description:
      page.summary ??
      `${page.organization_name} maintains an active CMMC Level 1 self-assessment, attested through Custodia.`,
  };
}

export default async function TrustPage(
  props: PageProps<"/trust/[slug]">,
) {
  const { slug } = await props.params;
  const page = await loadTrustPage(slug);
  if (!page) notFound();

  const signedDate = page.attestation_signed_at
    ? new Date(page.attestation_signed_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Verified by Custodia
        </div>
        <h1 className="mb-2 font-serif text-4xl text-slate-900">
          {page.headline ?? `${page.organization_name} — Trust & Compliance`}
        </h1>
        <p className="mb-8 text-lg text-slate-700">
          {page.summary ??
            `${page.organization_name} maintains an active CMMC Level 1 self-assessment under FAR 52.204-21. This page is published by ${page.organization_name} via Custodia.`}
        </p>

        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <Card label="Framework" value="CMMC Level 1 (FAR 52.204-21)" />
          <Card
            label="Last attestation"
            value={signedDate ?? "In progress"}
          />
          <Card label="17 of 17 practices" value={signedDate ? "Met" : "Under review"} />
          <Card
            label="Continuous monitoring"
            value="Enabled (Custodia platform)"
          />
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-xl text-slate-900">
            What this page is, and isn&apos;t
          </h2>
          <p className="mb-3 text-sm text-slate-700">
            This page is a public trust statement. It confirms that{" "}
            {page.organization_name} maintains an annual CMMC Level 1
            self-assessment using the Custodia platform, with a signed,
            hash-anchored evidence pack on file.
          </p>
          <p className="text-sm text-slate-700">
            CMMC Level 1 is a self-assessed framework. Primes and
            contracting officers requesting independent verification should
            contact{" "}
            {page.contact_email ? (
              <a
                href={`mailto:${page.contact_email}`}
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                {page.contact_email}
              </a>
            ) : (
              <span>the organization directly</span>
            )}{" "}
            to request the signed evidence pack.
          </p>
        </section>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-center text-white shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
            Custodia
          </div>
          <p className="text-slate-300">
            Want this for your company?{" "}
            <Link
              href="/sprs-check"
              className="font-semibold text-amber-300 hover:text-amber-200"
            >
              Take the free SPRS quiz
            </Link>
            .
          </p>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Last updated{" "}
          {new Date(page.updated_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}
