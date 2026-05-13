import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  getBusinessProfile,
} from "@/lib/assessment";
import { resolveOrgBranding } from "@/lib/org-branding";
import { updateBusinessProfileManualAction } from "../../actions";

export default async function ProfilePage(
  props: PageProps<"/assessments/[id]/profile">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const profile = await getBusinessProfile(ctx.organization.id);
  const data = (profile?.data ?? {}) as Record<string, unknown>;
  const completeness = profile?.completeness_score ?? 0;
  const branding = resolveOrgBranding(ctx.organization, data);
  const sp = (await props.searchParams) as Record<string, string | string[] | undefined>;
  const justSaved = sp?.saved === "1";
  const logoError = sp?.logo_error === "size" ? "Logo must be under 2 MB." : sp?.logo_error === "type" ? "Logo must be an image (PNG, JPG, SVG, WebP)." : null;

  const legalName =
    ctx.organization.name !== "My Organization" ? ctx.organization.name : "";
  const entityType = ctx.organization.entity_type ?? "";
  const scopedSystems = ctx.organization.scoped_systems ?? "";

  const fields: Array<{
    name: string;
    label: string;
    aliases: string[];
    helper?: string;
    multiline?: boolean;
  }> = [
    {
      name: "what_they_do",
      label: "What you do",
      aliases: ["what_they_do", "what_we_do"],
      helper: "One sentence — used on capability statements and the SSP intro.",
      multiline: true,
    },
    {
      name: "customers",
      label: "Customers",
      aliases: ["customers", "primary_customers", "target_customers"],
      helper: "Who you sell to (agencies, primes, sectors).",
      multiline: true,
    },
    {
      name: "team_size",
      label: "Team size",
      aliases: ["team_size"],
      helper: "Headcount + roles — feeds the authorized-user roster.",
      multiline: true,
    },
    {
      name: "physical_workspace",
      label: "Physical workspace",
      aliases: ["physical_workspace", "workspace", "physical_location"],
      helper: "Office, home offices, co-working — drives physical-protection scope.",
      multiline: true,
    },
    {
      name: "it_identity",
      label: "IT identity",
      aliases: ["it_identity", "identity_provider", "tech_stack"],
      helper: "Identity provider, endpoints, MDM, primary SaaS in scope.",
      multiline: true,
    },
    {
      name: "data_location",
      label: "Where data lives",
      aliases: ["data_location", "fci_location", "where_data_lives"],
      helper: "Where FCI is processed/stored/transmitted.",
      multiline: true,
    },
  ];

  const valueFor = (aliases: string[]): string => {
    for (const k of aliases) {
      const v = data[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 1 of 8
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Your business profile
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Edit anything directly below or refine conversationally with your
          compliance officer. Everything here flows into your SSP, affirmation
          memo, and the per-practice narratives.
        </p>
      </header>

      {justSaved ? (
        <div className="mb-6 border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Profile saved. The SSP and affirmation memo will reflect your edits
          the next time you open them.
        </div>
      ) : null}

      <form
        action={updateBusinessProfileManualAction}
        encType="multipart/form-data"
        className="mb-6 border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]"
      >
        <input type="hidden" name="assessmentId" value={id} />

        {/* Brand — drives the customer-facing header bar on the SSP,
            affirmation memo, and zipped HTML so deliverables look like the
            customer's letterhead instead of Custodia's. */}
        <div className="mb-6 border border-[#cfe3d9] border-l-4 border-l-[#f59e0b] bg-[#fffbf2] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#10231d]">
                Brand your deliverables
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">
                Your SSP, affirmation memo, and bid-ready ZIP will be branded
                with your company logo + contact details. Custodia stays as
                the verifier in a small footer note (so primes can validate
                the document) but the document itself is yours.
              </p>
            </div>
            {branding.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={branding.logoUrl}
                alt={`${ctx.organization.name} logo`}
                className="h-16 w-auto border border-[#cfe3d9] bg-white p-2"
              />
            ) : null}
          </div>
          {logoError ? (
            <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {logoError}
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex min-w-0 flex-col border border-[#cfe3d9] bg-white px-4 py-3 md:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Company logo
              </span>
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="mt-2 w-full text-xs text-[#10231d] file:mr-3 file:border file:border-[#cfe3d9] file:bg-[#f5f8f6] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#0e2a23] hover:file:bg-[#e8f1ec]"
              />
              <span className="mt-2 text-[11px] leading-snug text-[#5a7d70]">
                PNG, JPG, SVG, or WebP. Up to 2 MB. A horizontal lockup or
                square mark both work — we render it at ~64px tall on the
                header bar.
              </span>
              {branding.logoUrl ? (
                <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-[#5a7d70]">
                  <input type="checkbox" name="remove_logo" value="1" />
                  Remove current logo
                </label>
              ) : null}
            </label>
            <Field
              name="website"
              label="Website"
              defaultValue={branding.website ?? ""}
              placeholder="yourcompany.com"
              helper="Shown on the SSP and affirmation header."
            />
            <Field
              name="phone"
              label="Phone"
              defaultValue={branding.phone ?? ""}
              placeholder="(555) 123-4567"
              helper="Public point-of-contact line for primes."
            />
            <Field
              name="customer_facing_email"
              label="Public email"
              defaultValue={branding.email ?? ""}
              placeholder="contracts@yourcompany.com"
              helper="Where primes should reach you about this attestation."
            />
            <Field
              name="street_address"
              label="Street address"
              defaultValue={branding.addressLine1 ?? ""}
              placeholder="100 Federal Plaza"
            />
            <Field
              name="street_address_2"
              label="Street address 2"
              defaultValue={branding.addressLine2 ?? ""}
              placeholder="Suite 400"
            />
            <Field
              name="city"
              label="City"
              defaultValue={branding.city ?? ""}
              placeholder="Pittsburgh"
            />
            <Field
              name="state"
              label="State"
              defaultValue={branding.state ?? ""}
              placeholder="PA"
            />
            <Field
              name="zip"
              label="ZIP"
              defaultValue={branding.zip ?? ""}
              placeholder="15222"
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#10231d]">
              Captured details
            </h2>
            <p className="mt-1 text-xs text-[#5a7d70]">
              Profile completeness: {completeness}%
            </p>
          </div>
          <Link
            href="/onboard"
            className="border border-[#cfe3d9] bg-white px-3 py-1.5 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
          >
            Refine with officer
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            name="legalName"
            label="Legal name"
            defaultValue={legalName}
            placeholder="Custodia, LLC"
          />
          <Field
            name="entityType"
            label="Entity type"
            defaultValue={entityType}
            placeholder="LLC"
            helper="LLC, S-Corp, C-Corp, sole prop, etc."
          />

          {/* Optional ISSM (Information System Security Manager). Distinct
              from the Affirming Official: ISSM is the day-to-day security
              POC primes ask for on intake questionnaires; AO is the
              senior official who signs the annual affirmation. Optional
              for L1 — not required by SPRS — but high-leverage to capture
              now for the SSP "Roles & Responsibilities" table. */}
          <Field
            name="issm_name"
            label="ISSM name (optional)"
            defaultValue={typeof data.issm_name === "string" ? data.issm_name : ""}
            placeholder="Jane Smith"
            helper="Information System Security Manager — the day-to-day security POC. Distinct from the Affirming Official."
          />
          <Field
            name="issm_email"
            label="ISSM email (optional)"
            defaultValue={typeof data.issm_email === "string" ? data.issm_email : ""}
            placeholder="security@yourcompany.com"
            helper="Where primes can reach your ISSM on a compliance question."
          />

          {fields.map((f) => (
            <Field
              key={f.name}
              name={f.name}
              label={f.label}
              defaultValue={valueFor(f.aliases)}
              helper={f.helper}
              multiline={f.multiline}
              className={f.name === "what_they_do" ? "md:col-span-2" : ""}
            />
          ))}

          <Field
            name="scopedSystems"
            label="Systems in scope"
            defaultValue={scopedSystems}
            helper="Free-form paragraph — copied verbatim into the SSP and the affirmation memo."
            multiline
            rows={6}
            className="md:col-span-2"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#cfe3d9] pt-5">
          <p className="text-xs text-[#5a7d70]">
            Saved edits flow into every downstream artifact automatically.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/assessments/${id}`}
              className="border border-[#cfe3d9] bg-white px-4 py-2 text-xs font-bold text-[#0e2a23] hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-[#0e2a23] px-5 py-2 text-xs font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
            >
              Save changes
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-[#cfe3d9] bg-white px-5 py-4 text-sm text-[#5a7d70]">
        <span>
          Profile drives every downstream artifact &mdash; keep it accurate.
        </span>
        <Link
          href={`/assessments/${id}/registration`}
          className="bg-[#0e2a23] px-4 py-2 text-xs font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
        >
          Continue to federal registration &rarr;
        </Link>
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  defaultValue,
  helper,
  placeholder,
  multiline,
  rows,
  className,
}: {
  name: string;
  label: string;
  defaultValue: string;
  helper?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <label
      className={`flex min-w-0 flex-col border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3 ${className ?? ""}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
        {label}
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={rows ?? 3}
          className="mt-2 w-full resize-y border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none focus:ring-2 focus:ring-[#2f8f6d]/20"
        />
      ) : (
        <input
          type="text"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="mt-2 w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm text-[#10231d] focus:border-[#2f8f6d] focus:outline-none focus:ring-2 focus:ring-[#2f8f6d]/20"
        />
      )}
      {helper ? (
        <span className="mt-2 text-[11px] leading-snug text-[#5a7d70]">
          {helper}
        </span>
      ) : null}
    </label>
  );
}
