import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { enforceStepOrder, getAssessmentForUser } from "@/lib/assessment";
import { saveFederalRegistrationAction } from "../../actions";

const entityOptions = [
  "LLC",
  "C-Corp",
  "S-Corp",
  "Sole proprietor",
  "Partnership",
  "Nonprofit",
  "Other",
];

export default async function RegistrationPage(
  props: PageProps<"/assessments/[id]/registration">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();
  await enforceStepOrder(ctx, "registration");

  const org = ctx.organization;
  const hasUei = Boolean(org.sam_uei);
  const hasCage = Boolean(org.cage_code);
  const hasNaics = org.naics_codes.length > 0;
  // Once the user has saved a UEI but not yet a CAGE, they're in the
  // "waiting on DLA" window — show a friendly reminder banner instead of
  // blocking the next step.
  const cagePending = hasUei && !hasCage;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 2 of 7
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Federal contractor registration
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Before you can take a federal contract, the government needs to know
          who you are. You&apos;ll get a Unique Entity ID from SAM.gov and a
          contractor location code (CAGE) from the Defense Logistics Agency.
          Your industry codes describe what kind of work you do. All three
          appear on the yearly affirmation you sign in step 4.
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#7a9c90]">
          You only need your <strong>Unique Entity ID</strong> and at least
          one <strong>industry code</strong> to continue. SAM.gov issues the
          Unique Entity ID immediately; the CAGE code takes a few days &mdash;
          we&apos;ll remind you to add it when it arrives.
        </p>
      </header>

      {cagePending && (
        <div className="mb-6 flex items-start gap-3 border border-[#e6d3a8] bg-[#fdf6e3] px-4 py-3 text-xs leading-relaxed text-[#5c4a1d]">
          <span aria-hidden className="mt-0.5 text-base">⏳</span>
          <div>
            <p className="font-bold text-[#3d3210]">
              Waiting on your CAGE code
            </p>
            <p className="mt-1">
              The Defense Logistics Agency typically issues CAGE codes
              3&ndash;10 business days after SAM.gov submits your registration.
              Check your SAM.gov workspace &mdash; once the CAGE chip turns
              green, paste it here. You can keep working on the next steps in
              the meantime.
            </p>
          </div>
        </div>
      )}

      <ol className="mb-8 space-y-3">
        <Step
          n={1}
          title="Register on SAM.gov (free)"
          body="SAM.gov isn&apos;t intuitive the first time. Open our step-by-step walkthrough and we&apos;ll show you exactly what to click on every screen so you finish correctly the first time. Takes 45&ndash;90 minutes; you&apos;ll get your Unique Entity ID immediately and your CAGE code within ~5 business days."
          href="/sam-guide"
          cta="Open guided walkthrough"
        />
        <Step
          n={2}
          title="Pick the industry codes that match your work"
          body="Six-digit codes. Most contractors use one to three. The contract you bid on will tell you which ones the buyer expects."
          href="https://www.census.gov/naics/"
          cta="Industry code lookup"
        />
        <Step
          n={3}
          title="Enter what you have below"
          body="Enter your Unique Entity ID and industry codes to continue &mdash; that&apos;s all we need to unlock the next section. Add your CAGE code whenever SAM.gov issues it; we&apos;ll remind you here until you do."
        />
      </ol>

      <form
        action={saveFederalRegistrationAction}
        className=" border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Unique Entity ID"
            hint="12 letters and numbers, issued by SAM.gov."
            name="samUei"
            defaultValue={org.sam_uei ?? ""}
            placeholder="ABC123XYZ987"
            badge={hasUei ? "saved" : null}
            maxLength={12}
          />
          <Field
            label="CAGE code (optional for now)"
            hint="5 letters and numbers from the Defense Logistics Agency. Add it when SAM.gov shows it as issued."
            name="cageCode"
            defaultValue={org.cage_code ?? ""}
            placeholder="1A2B3"
            badge={hasCage ? "saved" : null}
            maxLength={5}
          />
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Entity type
            </label>
            <select
              name="entityType"
              defaultValue={org.entity_type ?? ""}
              className="w-full  border border-[#cfe3d9] bg-white px-3 py-2.5 text-sm text-[#10231d] outline-none transition-colors focus:border-[#2f8f6d]"
            >
              <option value="">Select&hellip;</option>
              {entityOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Industry codes (NAICS)"
            hint="Comma-separated, six digits each. Picked during SAM.gov's Goods & Services step."
            name="naicsCodes"
            defaultValue={org.naics_codes.join(", ")}
            placeholder="541512, 541519"
            badge={hasNaics ? "saved" : null}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#5a7d70]">
            We never share these. They appear only in your security plan and
            yearly affirmation.
          </p>
          <button
            type="submit"
            className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Save and continue
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-[#7a9c90]">
        The seventeen safeguarding practices unlock as soon as your Unique
        Entity ID and at least one industry code are saved above. You can add
        your CAGE code later &mdash; we&apos;ll remind you here until you do.
      </p>
    </main>
  );
}

function Step({
  n,
  title,
  body,
  href,
  cta,
}: {
  n: number;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <li className="flex gap-3  border border-[#cfe3d9] bg-white px-4 py-3 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
      <span className="flex h-6 w-6 flex-none items-center justify-center  bg-[#0e2a23] text-xs font-bold text-[#bdf2cf]">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-sm font-bold text-[#10231d]">{title}</h3>
          {href && cta && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className=" border border-[#cfe3d9] px-2.5 py-1 text-[11px] font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
            >
              {cta} &rarr;
            </a>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#5a7d70]">{body}</p>
      </div>
    </li>
  );
}

function Field({
  label,
  hint,
  name,
  defaultValue,
  placeholder,
  badge,
  maxLength,
}: {
  label: string;
  hint?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  badge?: "saved" | null;
  maxLength?: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          {label}
        </label>
        {badge === "saved" && (
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2f8f6d]">
            &bull; Saved
          </span>
        )}
      </div>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full  border border-[#cfe3d9] bg-white px-3 py-2.5 text-sm font-mono uppercase tracking-wider text-[#10231d] outline-none transition-colors placeholder:text-[#a8bdb3] placeholder:font-sans placeholder:normal-case focus:border-[#2f8f6d]"
      />
      {hint && (
        <p className="mt-1 text-[11px] text-[#7a9c90]">{hint}</p>
      )}
    </div>
  );
}
