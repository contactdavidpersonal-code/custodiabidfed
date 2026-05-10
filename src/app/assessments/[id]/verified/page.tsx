import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { enforceStepOrder, getAssessmentForUser } from "@/lib/assessment";
import { setAsideLabels } from "@/lib/bid-profile";
import { loadBidProfile } from "@/lib/bid-profile-server";
import { loadTrustPageForOrg } from "@/lib/trust-page";
import { ensureDbReady, getSql } from "@/lib/db";
import {
  publishVerifiedPageAction,
  unpublishVerifiedPageAction,
  rotateVerifiedPageSlugAction,
} from "../../actions";

export const dynamic = "force-dynamic";

type StatusRow = {
  health: "green" | "amber" | "red" | "gray" | null;
  health_reason: string | null;
  last_computed_at: string | null;
};

async function loadStatus(orgId: string): Promise<StatusRow | null> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT health, health_reason, last_computed_at
    FROM trust_status
    WHERE organization_id = ${orgId}
    LIMIT 1
  `) as StatusRow[];
  return rows[0] ?? null;
}

const HEALTH_LABELS = {
  green: "Healthy",
  amber: "Drift detected",
  red: "Action required",
  gray: "Status pending",
} as const;

export default async function VerifiedOwnerPanel(
  props: PageProps<"/assessments/[id]/verified">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "attested");

  const [trustPage, bidProfile, status] = await Promise.all([
    loadTrustPageForOrg(ctx.organization.id),
    loadBidProfile(ctx.organization.id).catch(() => ({ set_asides: [] as never })),
    loadStatus(ctx.organization.id),
  ]);

  if (!trustPage) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-10">
        <h1 className="font-serif text-3xl text-slate-900">
          Verified page not yet provisioned
        </h1>
        <p className="mt-4 text-sm text-slate-700">
          Your Custodia Verified page is created automatically the moment you
          record your SPRS filing on the assessment overview.
        </p>
        <Link
          href={`/assessments/${id}`}
          className="mt-6 inline-flex  bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
        >
          ← Back to assessment
        </Link>
      </main>
    );
  }

  const slug = trustPage.verification_slug ?? trustPage.slug;
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
  ).replace(/\/$/, "");
  const publicUrl = `${appUrl}/verified/${slug}`;
  // The "badge" is the Custodia shield logo itself — exactly what appears in
  // the platform header — wrapped in an anchor to the customer's public
  // Verified page. No composited org name or burned-in metadata; the page
  // it links to carries every detail. This keeps embeds light, cacheable
  // by the customer's CDN, and visually consistent with the brand.
  const badgeImg = `${appUrl}/custodia-logo.png`;
  const setAsides = bidProfile.set_asides ?? [];

  const altText = `CMMC Level 1 — Custodia Verified${
    trustPage.custodia_verification_id ? ` — ${trustPage.custodia_verification_id}` : ""
  }`;
  const embedHtmlLarge = `<a href="${publicUrl}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;font-family:system-ui,sans-serif"><img src="${badgeImg}" alt="${altText}" width="120" height="144" style="display:block;height:auto"/><div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#10231d">CMMC Level 1 · Verified</div></a>`;
  const embedHtmlSmall = `<a href="${publicUrl}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;font-family:system-ui,sans-serif"><img src="${badgeImg}" alt="${altText}" width="64" height="76" style="display:block;height:auto;vertical-align:middle"/></a>`;
  const embedMarkdown = `[![${altText}](${badgeImg})](${publicUrl})`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <Link
            href={`/assessments/${id}`}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            ← Back to assessment
          </Link>
          <h1 className="mt-2 font-serif text-3xl text-slate-900">
            Manage your Custodia Verified page
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Custodia ID:{" "}
            <span className="font-mono font-semibold text-slate-900">
              {trustPage.custodia_verification_id ?? "—"}
            </span>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${trustPage.is_public ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-50 text-slate-700"}`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${trustPage.is_public ? "bg-emerald-500" : "bg-slate-400"}`}
            aria-hidden
          />
          {trustPage.is_public ? "Published" : "Unpublished"}
        </span>
      </div>

      {/* Publish toggle */}
      <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-slate-900">Visibility</h2>
        <p className="mt-1 text-sm text-slate-600">
          When published, your page is indexed by search engines and visible at{" "}
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-emerald-700 underline"
          >
            {publicUrl}
          </a>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {trustPage.is_public ? (
            <form action={unpublishVerifiedPageAction}>
              <input type="hidden" name="assessmentId" value={id} />
              <button
                type="submit"
                className=" border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400"
              >
                Unpublish
              </button>
            </form>
          ) : (
            <form action={publishVerifiedPageAction}>
              <input type="hidden" name="assessmentId" value={id} />
              <button
                type="submit"
                className=" bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
              >
                Publish
              </button>
            </form>
          )}
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className=" border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400"
          >
            View public page →
          </a>
        </div>
        {status ? (
          <p className="mt-3 text-xs text-slate-500">
            Health: <strong>{HEALTH_LABELS[status.health ?? "gray"]}</strong>
            {status.health_reason ? ` — ${status.health_reason}` : ""}
          </p>
        ) : null}
      </section>

      {/* Set-asides nudge */}
      {setAsides.length === 0 ? (
        <section className="mb-6  border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="font-serif text-lg text-amber-900">
            Add your designations
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Add 8(a), WOSB, HUBZone, SDVOSB, and other set-asides in your
            bid-ready profile and they&rsquo;ll appear on your Verified page
            automatically.
          </p>
          <Link
            href="/profile/bid-ready"
            className="mt-3 inline-flex  bg-amber-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-800"
          >
            Open bid-ready profile →
          </Link>
        </section>
      ) : (
        <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg text-slate-900">
            Designations on file
          </h2>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {setAsides.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-emerald-700">✓</span>
                <span>{setAsideLabels[s]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Content + toggles intentionally removed — the Custodia Verified
          page is a standardized third-party attestation, identical layout
          for every client. Identity, set-asides, monitoring, and SPRS
          filing data are pulled live from your federal record and the
          platform's monitoring signals. */}

      {/* Embed snippets */}
      <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-slate-900">Embed your badge</h2>
        <p className="mt-1 text-sm text-slate-600">
          The badge is the Custodia shield itself — drop it into your website
          footer, capability statement, or email signature. Clicking opens
          your public Custodia Verified page so primes and contracting
          officers can vet you in seconds.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Large (with caption)
            </h3>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex flex-col items-center gap-2 border border-slate-200 bg-[#0a1814] p-6"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/custodia-logo.png"
                alt={altText}
                width={120}
                height={144}
                className="h-28 w-auto"
              />
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f59e0b]">
                CMMC Level 1 · Verified
              </div>
            </a>
            <CodeBlock label="HTML" code={embedHtmlLarge} />
            <CodeBlock label="Markdown" code={embedMarkdown} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Compact (email signature)
            </h3>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-3 border border-slate-200 bg-white px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/custodia-logo.png"
                alt={altText}
                width={64}
                height={76}
                className="h-16 w-auto"
              />
              <div className="text-left">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2f8f6d]">
                  Custodia Verified
                </div>
                <div className="text-sm font-bold text-[#10231d]">
                  CMMC Level 1
                </div>
              </div>
            </a>
            <CodeBlock label="HTML" code={embedHtmlSmall} />
            <CodeBlock label="Direct link" code={publicUrl} />
          </div>
        </div>
      </section>

      {/* Rotate slug */}
      <section className="mb-6  border border-red-200 bg-red-50/40 p-6 shadow-sm">
        <h2 className="font-serif text-lg text-red-900">
          Rotate Custodia ID &amp; URL
        </h2>
        <p className="mt-1 text-sm text-red-900">
          Use this only if you suspect your current public URL or badge has
          been compromised, or if you need to invalidate previously-shared
          links. Rotating breaks all existing badges and embeds — you&rsquo;ll
          need to re-paste the new snippets everywhere they live. The new
          Custodia ID is derived from the same SPRS filing; nothing about
          your federal record changes.
        </p>
        <form action={rotateVerifiedPageSlugAction} className="mt-4">
          <input type="hidden" name="assessmentId" value={id} />
          <button
            type="submit"
            className=" border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-900 hover:bg-red-50"
          >
            Rotate ID and URL
          </button>
        </form>
      </section>
    </main>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <pre className="mt-1 overflow-x-auto  border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}
