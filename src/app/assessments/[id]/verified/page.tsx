import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
import { loadBidProfile, setAsideLabels } from "@/lib/bid-profile";
import { loadTrustPageForOrg } from "@/lib/trust-page";
import { ensureDbReady, getSql } from "@/lib/db";
import {
  publishVerifiedPageAction,
  unpublishVerifiedPageAction,
  updateVerifiedPageAction,
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

  const [trustPage, bidProfile, status] = await Promise.all([
    loadTrustPageForOrg(ctx.organization.id),
    loadBidProfile(ctx.organization.id).catch(() => ({ set_asides: [] as never })),
    loadStatus(ctx.organization.id),
  ]);

  if (!trustPage) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
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
  const badgeWide = `${appUrl}/api/badge/${slug}`;
  const badgeSquare = `${appUrl}/api/badge/${slug}?size=square`;
  const setAsides = bidProfile.set_asides ?? [];

  const embedHtmlWide = `<a href="${publicUrl}" target="_blank" rel="noopener"><img src="${badgeWide}" alt="Custodia Verified — ${ctx.organization.name}" width="240" height="60"/></a>`;
  const embedHtmlSquare = `<a href="${publicUrl}" target="_blank" rel="noopener"><img src="${badgeSquare}" alt="Custodia Verified — ${ctx.organization.name}" width="120" height="120"/></a>`;
  const embedMarkdown = `[![Custodia Verified](${badgeWide})](${publicUrl})`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
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

      {/* Content + toggles */}
      <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-slate-900">
          Content &amp; sections
        </h2>
        <form action={updateVerifiedPageAction} className="mt-4 space-y-5">
          <input type="hidden" name="assessmentId" value={id} />
          <div>
            <label
              htmlFor="customAbout"
              className="block text-sm font-semibold text-slate-900"
            >
              About (max 500 characters)
            </label>
            <textarea
              id="customAbout"
              name="customAbout"
              defaultValue={trustPage.custom_about ?? ""}
              maxLength={500}
              rows={5}
              className="mt-1 w-full  border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="What you build, who you serve, and what makes you a strong subcontractor."
            />
            <p className="mt-1 text-xs text-slate-500">
              Plain text. No HTML. Shown in the &ldquo;About&rdquo; section of
              your public page.
            </p>
          </div>
          <div>
            <label
              htmlFor="contactEmail"
              className="block text-sm font-semibold text-slate-900"
            >
              Contact email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={trustPage.contact_email ?? ""}
              className="mt-1 w-full  border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="bd@yourcompany.com"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900">
              Sections to display
            </legend>
            <ToggleField
              name="showContinuousMonitoring"
              label="Continuous monitoring section"
              defaultChecked={trustPage.show_continuous_monitoring}
            />
            <ToggleField
              name="showConnectors"
              label="Microsoft 365 / Google Workspace status rows"
              defaultChecked={trustPage.show_connectors}
            />
            <ToggleField
              name="showSprsLink"
              label="“Verify SPRS by UEI” outbound link"
              defaultChecked={trustPage.show_sprs_link}
            />
            <ToggleField
              name="showSetAsides"
              label="Set-asides (pulled from bid-ready profile)"
              defaultChecked={trustPage.show_set_asides}
            />
          </fieldset>
          <button
            type="submit"
            className=" bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
          >
            Save changes
          </button>
        </form>
      </section>

      {/* Embed snippets */}
      <section className="mb-6  border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-slate-900">Embed your badge</h2>
        <p className="mt-1 text-sm text-slate-600">
          Drop into your website footer, capability statement, or email
          signature. The badge auto-updates as your monitoring signals change.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Wide (240×60)
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeWide}
              alt="Wide Custodia Verified badge preview"
              width={240}
              height={60}
              className="mt-2"
            />
            <CodeBlock label="HTML" code={embedHtmlWide} />
            <CodeBlock label="Markdown" code={embedMarkdown} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Square (120×120)
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeSquare}
              alt="Square Custodia Verified badge preview"
              width={120}
              height={120}
              className="mt-2"
            />
            <CodeBlock label="HTML" code={embedHtmlSquare} />
            <CodeBlock label="Plain URL" code={publicUrl} />
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

function ToggleField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-900">
      {/* Marker tells the server action that this toggle was rendered, so an
          unchecked checkbox is interpreted as "off" instead of "leave as-is". */}
      <input type="hidden" name={`${name}__present`} value="1" />
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        value="on"
        className="h-4 w-4  border-slate-300 text-emerald-700 focus:ring-emerald-500"
      />
      <span>{label}</span>
    </label>
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
