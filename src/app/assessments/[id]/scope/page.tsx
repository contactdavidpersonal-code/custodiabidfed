import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { enforceStepOrder, getAssessmentForUser } from "@/lib/assessment";
import {
  listEsps,
  listScopeItems,
  listSpecializedAssets,
  scopeKindLabels,
  specializedAssetLabels,
} from "@/lib/cmmc/scope";
import {
  addEspAction,
  addScopeItemAction,
  addSpecializedAssetAction,
  retireScopeItemAction,
} from "./actions";
import {
  ScopeCharlieButton,
  ScopeRefreshOnCharlie,
} from "./ScopeCharlieButton";

/**
 * CMMC L1 v2.13 scope inventory wizard. The user MUST identify People,
 * Technology, Facilities, and ESPs that handle FCI before assessment results
 * are meaningful (32 CFR § 170.19(b)(3)). Specialized Assets are documented
 * but not assessed (§ 170.19(b)(2)(ii)).
 */
export default async function ScopePage(
  props: PageProps<"/assessments/[id]/scope">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  // Scope is its own gated step — § 170.19(b)(3) requires People, Technology,
  // Facility, and ESP rows before practice work is meaningful. enforceStepOrder
  // will bounce the user back to whichever earlier step they still owe.
  await enforceStepOrder(ctx, "scope");

  const orgId = ctx.organization.id;
  const [scope, esps, specialized] = await Promise.all([
    listScopeItems(orgId),
    listEsps(orgId),
    listSpecializedAssets(orgId),
  ]);

  const grouped = {
    people: scope.filter((s) => s.kind === "people"),
    technology: scope.filter((s) => s.kind === "technology"),
    facility: scope.filter((s) => s.kind === "facility"),
    esp: scope.filter((s) => s.kind === "esp"),
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <ScopeRefreshOnCharlie />
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 3 of 8 · Scope inventory · 32 CFR § 170.19
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          What&apos;s in scope for your assessment
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#5a7d70]">
          Per the CMMC Scoping Guide – Level 1 (v2.13), you must list the
          People, Technology, Facilities, and External Service Providers in
          your environment that <strong>process, store, or transmit Federal
          Contract Information</strong>. Specialized Assets (IoT, Operational
          Technology, Government-Furnished Equipment, etc.) are documented for
          completeness but are <strong>not assessed</strong> against the 15
          requirements.
        </p>
      </header>

      <section className="mb-10 border border-[#0e2a23] bg-[#0e2a23] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#bdf2cf]">
              Pro tip · Charlie can do this for you
            </p>
            <h2 className="mt-2 font-serif text-xl font-bold">
              Don&apos;t want to fill out forms? Let your vCO interview you.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#cfe3d9]">
              Charlie will ask a few plain-English questions and write the
              People, Technology, Facilities, ESPs, and Specialized Assets
              into your inventory automatically. Pros can still use the forms
              below. Either way works — pick whichever&apos;s faster.
            </p>
          </div>
          <ScopeCharlieButton
            variant="primary"
            label="Do this with Charlie"
            helper="Walks you through the whole scope inventory in chat."
            prompt="Let's build my scope inventory together. Walk me through People, Technology, Facilities, ESPs, and any Specialized Assets one section at a time. Read my current scope first so we don't duplicate, ask focused questions for whatever's missing, and use add_scope_item / add_esp / add_specialized_asset to save each item as we go. When you finish a section, summarize what you wrote and move on."
          />
        </div>
      </section>

      <ScopeSection
        kind="people"
        title="People"
        helper="Employees, contractors, and roles that touch FCI."
        items={grouped.people}
        assessmentId={id}
        roleLabel="Role / job title"
        charliePrompt="Help me list the People in my CMMC scope. Read my scope inventory first to see who's already listed, then ask me about employees, contractors, and any external roles who handle Federal Contract Information. Save each one with add_scope_item (kind: 'people'). When you've covered everyone, give me a short summary."
      />
      <ScopeSection
        kind="technology"
        title="Technology"
        helper="Laptops, servers, SaaS apps, cloud accounts, network gear that store or move FCI."
        items={grouped.technology}
        assessmentId={id}
        roleLabel="What it does (e.g. file server, email)"
        charliePrompt="Help me list the Technology in my CMMC scope — laptops, servers, SaaS apps, cloud accounts, network gear that processes, stores, or transmits FCI. Read my current scope first, then ask me what I use for email, file storage, identity, devices, and network. Save each with add_scope_item (kind: 'technology')."
      />
      <ScopeSection
        kind="facility"
        title="Facilities"
        helper="Offices, labs, warehouses, home offices where FCI is handled."
        items={grouped.facility}
        assessmentId={id}
        roleLabel="Address or building"
        charliePrompt="Help me list the Facilities in my CMMC scope — offices, labs, home offices, warehouses where FCI is handled. Read my scope first, then ask about each location. Save each with add_scope_item (kind: 'facility')."
      />

      <section className="mb-12 border border-[#cfe3d9] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#10231d]">
              External Service Providers (ESPs)
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-[#5a7d70]">
              Vendors and managed services that process, store, or transmit your
              FCI on your behalf — Microsoft 365 / Google Workspace, AWS, your MSP,
              a contracted helpdesk. ESPs are in scope. You can inherit assessment
              objectives from an ESP when responsibilities are documented and the
              provider&apos;s posture is sufficient.
            </p>
          </div>
          <ScopeCharlieButton
            label="Ask Charlie"
            helper="Charlie will register your ESPs after a few questions."
            prompt="Help me register my External Service Providers (ESPs). Read my current ESPs first, then ask me about email/document tooling (M365 vs Google Workspace), identity provider, cloud accounts (AWS/Azure/GCP), MSP/IT support, and any contracted helpdesk or compliance vendor. For each, capture vendor, services, CMMC status if known, contact email, and attestation URL if I have it. Save each with add_esp."
          />
        </div>

        {esps.length > 0 && (
          <ul className="mt-4 divide-y divide-[#e6efe9]">
            {esps.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-bold text-[#10231d]">{e.name}</span>
                  {e.vendor && (
                    <span className="text-xs text-[#5a7d70]">
                      vendor: {e.vendor}
                    </span>
                  )}
                  {e.cmmc_status && (
                    <span className="border border-[#bde0cc] bg-[#eaf3ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0e2a23]">
                      {e.cmmc_status}
                    </span>
                  )}
                </div>
                {e.services && (
                  <p className="mt-1 text-xs text-[#5a7d70]">{e.services}</p>
                )}
                {(e.contact_email || e.attestation_doc_url) && (
                  <p className="mt-1 text-xs text-[#5a7d70]">
                    {e.contact_email && <span>{e.contact_email}</span>}
                    {e.contact_email && e.attestation_doc_url && " · "}
                    {e.attestation_doc_url && (
                      <a
                        href={e.attestation_doc_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-[#0e2a23]"
                      >
                        attestation/SOC report
                      </a>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          action={addEspAction}
          className="mt-5 grid gap-3 border-t border-[#e6efe9] pt-5 md:grid-cols-2"
        >
          <input type="hidden" name="assessmentId" value={id} />
          <Field name="name" label="ESP name" required placeholder="Microsoft 365" />
          <Field name="vendor" label="Vendor" placeholder="Microsoft" />
          <Field
            name="services"
            label="Services provided"
            placeholder="Email, document storage, identity"
            full
          />
          <Field
            name="cmmcStatus"
            label="Their CMMC status"
            placeholder="Final Level 2 (C3PAO) / GCC High / etc."
          />
          <Field
            name="contactEmail"
            label="Account contact email"
            type="email"
            placeholder="csm@vendor.com"
          />
          <Field
            name="attestationDocUrl"
            label="Attestation / SOC report URL"
            type="url"
            placeholder="https://…"
            full
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              className="border border-[#0e2a23] bg-[#0e2a23] px-4 py-2 text-sm font-bold text-white hover:bg-[#10231d]"
            >
              Add ESP
            </button>
          </div>
        </form>
      </section>

      <section className="mb-12 border border-[#e6d3a8] bg-[#fdf6e3] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#10231d]">
              Specialized Assets
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-[#5a7d70]">
              IoT, Industrial IoT, Operational Technology, Government-Furnished
              Equipment, Restricted Information Systems, and Test Equipment.
              Per 32 CFR § 170.19(b)(2)(ii), these are <strong>documented but not
              assessed</strong> against the 15 requirements. Listing them keeps
              your assessment complete and makes Enduring Exceptions defensible.
            </p>
          </div>
          <ScopeCharlieButton
            label="Ask Charlie"
            helper="Charlie will document any IoT/OT/GFE you mention."
            prompt="Help me document any Specialized Assets — IoT, Industrial IoT, Operational Technology, Government-Furnished Equipment, Restricted Information Systems, or Test Equipment. Read what's already documented, then ask me whether I have any of those categories and capture each one. Save with add_specialized_asset. If I have none, just confirm that and we'll move on."
          />
        </div>

        {specialized.length > 0 && (
          <ul className="mt-4 divide-y divide-[#e6d3a8]">
            {specialized.map((s) => (
              <li key={s.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-bold text-[#10231d]">{s.label}</span>
                  <span className="text-xs uppercase tracking-wider text-[#a06b1a]">
                    {specializedAssetLabels[s.asset_type]}
                  </span>
                  {s.handles_fci && (
                    <span className="border border-[#f1c4bd] bg-[#fbe9e6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#b03a2e]">
                      Touches FCI
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="mt-1 text-xs text-[#7a6a3a]">{s.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          action={addSpecializedAssetAction}
          className="mt-5 grid gap-3 border-t border-[#e6d3a8] pt-5 md:grid-cols-2"
        >
          <input type="hidden" name="assessmentId" value={id} />
          <Field name="label" label="Asset label" required placeholder="Test bench RT-2" />
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-[#10231d]">
              Asset type
            </span>
            <select
              name="assetType"
              required
              className="w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm"
            >
              {Object.entries(specializedAssetLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Field
            name="description"
            label="Description"
            placeholder="Air-gapped test fixture, no network."
            full
          />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="handlesFci" />
            <span>This asset processes, stores, or transmits FCI</span>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="border border-[#a06b1a] bg-[#a06b1a] px-4 py-2 text-sm font-bold text-white hover:bg-[#8b5a14]"
            >
              Document specialized asset
            </button>
          </div>
        </form>
      </section>
    </main>
  );

  // Local components scoped to this page so we don't proliferate one-off
  // exports in src/components.
  function ScopeSection({
    kind,
    title,
    helper,
    items,
    assessmentId,
    roleLabel,
    charliePrompt,
  }: {
    kind: "people" | "technology" | "facility";
    title: string;
    helper: string;
    items: Array<{
      id: string;
      label: string;
      role: string | null;
      handles_fci: boolean;
      notes: string | null;
    }>;
    assessmentId: string;
    roleLabel: string;
    charliePrompt: string;
  }) {
    return (
      <section className="mb-10 border border-[#cfe3d9] bg-white p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#10231d]">
              {title}
              <span className="ml-2 text-sm font-normal text-[#5a7d70]">
                ({scopeKindLabels[kind]})
              </span>
            </h2>
            <p className="mt-1 text-sm text-[#5a7d70]">{helper}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ScopeCharlieButton
              label="Ask Charlie"
              helper={`Charlie will interview you and fill in your ${title.toLowerCase()}.`}
              prompt={charliePrompt}
            />
            <span className="text-xs text-[#5a7d70]">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        {items.length > 0 && (
          <ul className="mt-4 divide-y divide-[#e6efe9]">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-bold text-[#10231d]">
                      {item.label}
                    </span>
                    {item.role && (
                      <span className="text-xs text-[#5a7d70]">
                        {item.role}
                      </span>
                    )}
                    {item.handles_fci ? (
                      <span className="border border-[#bde0cc] bg-[#eaf3ee] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0e2a23]">
                        Handles FCI
                      </span>
                    ) : (
                      <span className="border border-[#cfe3d9] bg-[#f1f6f3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5a7d70]">
                        Out of FCI flow
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="mt-1 text-xs text-[#5a7d70]">{item.notes}</p>
                  )}
                </div>
                <form action={retireScopeItemAction}>
                  <input type="hidden" name="assessmentId" value={assessmentId} />
                  <input type="hidden" name="scopeItemId" value={item.id} />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-[#b03a2e] underline hover:text-[#7d281f]"
                  >
                    Retire
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addScopeItemAction}
          className="mt-5 grid gap-3 border-t border-[#e6efe9] pt-5 md:grid-cols-2"
        >
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="kind" value={kind} />
          <Field name="label" label="Name / label" required />
          <Field name="role" label={roleLabel} />
          <Field name="notes" label="Notes" full />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="handlesFci" defaultChecked />
            <span>Handles FCI (process / store / transmit)</span>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="border border-[#0e2a23] bg-[#0e2a23] px-4 py-2 text-sm font-bold text-white hover:bg-[#10231d]"
            >
              Add to {title.toLowerCase()}
            </button>
          </div>
        </form>
      </section>
    );
  }
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  full,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block text-sm ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-1.5 block font-semibold text-[#10231d]">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border border-[#cfe3d9] bg-white px-3 py-2 text-sm placeholder:text-[#a8c0b4] focus:border-[#0e2a23] focus:outline-none"
      />
    </label>
  );
}
