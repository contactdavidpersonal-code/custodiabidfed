import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
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

  const org = ctx.organization;
  const hasUei = Boolean(org.sam_uei);
  const hasCage = Boolean(org.cage_code);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 2 of 7
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Federal registration
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Before you can take a federal contract, the government needs to know
          who you are. SAM.gov gives you a UEI; DLA assigns a CAGE code. NAICS
          codes describe what you do. All three appear on your CMMC
          affirmation.
        </p>
      </header>

      <ol className="mb-8 space-y-3">
        <Step
          n={1}
          title="Register on SAM.gov"
          body="Free. Takes 7&ndash;10 business days the first time. You'll receive a UEI immediately and a CAGE code within a week."
          href="https://sam.gov"
          cta="Open SAM.gov"
        />
        <Step
          n={2}
          title="Pick the NAICS codes that match your work"
          body="Six-digit codes. Most contractors use 1&ndash;3. The contract solicitation will tell you which ones the buyer expects."
          href="https://www.census.gov/naics/"
          cta="NAICS lookup"
        />
        <Step
          n={3}
          title="Enter what you have below"
          body="You can enter the UEI now and add CAGE later &mdash; SAM issues UEI immediately but CAGE takes a few days."
        />
      </ol>

      <form
        action={saveFederalRegistrationAction}
        className=" border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="SAM.gov UEI"
            hint="12 letters/numbers"
            name="samUei"
            defaultValue={org.sam_uei ?? ""}
            placeholder="ABC123XYZ987"
            badge={hasUei ? "saved" : null}
            maxLength={12}
          />
          <Field
            label="CAGE code"
            hint="5 letters/numbers"
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
            label="NAICS codes"
            hint="Comma-separated 6-digit codes"
            name="naicsCodes"
            defaultValue={org.naics_codes.join(", ")}
            placeholder="541512, 541519"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#5a7d70]">
            We never share these. They appear in your SSP and SPRS affirmation
            only.
          </p>
          <button
            type="submit"
            className=" bg-[#0e2a23] px-5 py-2.5 text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Save and continue
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3  border border-dashed border-[#cfe3d9] bg-white px-5 py-4 text-sm text-[#5a7d70]">
        <span>Once saved, head into the 17 CMMC L1 practices.</span>
        <Link
          href={`/assessments/${id}`}
          className=" border border-[#cfe3d9] bg-white px-4 py-2 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
        >
          Continue to practices &rarr;
        </Link>
      </div>
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
