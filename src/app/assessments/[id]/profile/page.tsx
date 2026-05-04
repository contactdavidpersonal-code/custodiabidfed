import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getAssessmentForUser,
  getBusinessProfile,
} from "@/lib/assessment";

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

  const rows: Array<{ label: string; value: string | null }> = [
    {
      label: "Legal name",
      value:
        ctx.organization.name !== "My Organization" ? ctx.organization.name : null,
    },
    { label: "Entity type", value: ctx.organization.entity_type },
    {
      label: "What you do",
      value: stringField(data, "what_they_do") ?? stringField(data, "what_we_do"),
    },
    {
      label: "Customers",
      value:
        stringField(data, "customers") ??
        stringField(data, "primary_customers") ??
        stringField(data, "target_customers"),
    },
    {
      label: "Team size",
      value: stringField(data, "team_size"),
    },
    {
      label: "Physical workspace",
      value:
        stringField(data, "physical_workspace") ??
        stringField(data, "workspace") ??
        stringField(data, "physical_location"),
    },
    {
      label: "IT identity",
      value:
        stringField(data, "it_identity") ??
        stringField(data, "identity_provider") ??
        stringField(data, "tech_stack"),
    },
    {
      label: "Where data lives",
      value:
        stringField(data, "data_location") ??
        stringField(data, "fci_location") ??
        stringField(data, "where_data_lives"),
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Step 1 of 7
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          Your business profile
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Captured conversationally through your compliance officer. Everything
          here flows into your SSP, affirmation memo, and the per-practice
          narratives. Refine anything by chatting with the officer on the
          right or by re-running onboarding.
        </p>
      </header>

      <section className="mb-6  border border-[#cfe3d9] bg-white p-6 shadow-[0_2px_0_rgba(14,48,37,0.04)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#10231d]">
              Captured details
            </h2>
            <p className="mt-1 text-xs text-[#5a7d70]">
              Profile completeness: {completeness}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/onboard"
              className=" border border-[#cfe3d9] bg-white px-3 py-1.5 text-xs font-bold text-[#0e2a23] transition-colors hover:border-[#2f8f6d] hover:bg-[#f1f6f3]"
            >
              Refine with officer
            </Link>
          </div>
        </div>
        <dl className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className=" border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3"
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                {r.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#10231d]">
                {r.value ? (
                  r.value
                ) : (
                  <span className="font-normal italic text-[#7a9c90]">
                    Not captured yet
                  </span>
                )}
              </dd>
            </div>
          ))}
          <div className=" border border-[#cfe3d9] bg-[#f7fcf9] px-4 py-3 md:col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Systems in scope
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-[#10231d]">
              {ctx.organization.scoped_systems ?? (
                <span className="italic text-[#7a9c90]">Not captured yet</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3  border border-dashed border-[#cfe3d9] bg-white px-5 py-4 text-sm text-[#5a7d70]">
        <span>
          Profile drives every downstream artifact &mdash; keep it accurate.
        </span>
        <Link
          href={`/assessments/${id}/registration`}
          className=" bg-[#0e2a23] px-4 py-2 text-xs font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
        >
          Continue to federal registration &rarr;
        </Link>
      </div>
    </main>
  );
}

function stringField(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}
