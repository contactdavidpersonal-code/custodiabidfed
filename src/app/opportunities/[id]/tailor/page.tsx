import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ensureOrgForUser,
  listAssessmentsForOrg,
} from "@/lib/assessment";
import { loadBidProfile } from "@/lib/bid-profile";
import { getSql } from "@/lib/db";
import { TailorForm } from "@/app/assessments/[id]/bid-packet/tailor/TailorForm";
import { tailorOpportunityAction } from "@/app/assessments/[id]/bid-packet/tailor/actions";

export const dynamic = "force-dynamic";

/**
 * Per-opportunity tailor entry from the SAM.gov inbox. Loads the matched
 * opportunity, finds the user's most recent assessment, and renders the
 * existing TailorForm pre-filled with the SAM notice description so the
 * "paste the solicitation" step is already done. Marks the opportunity as
 * viewed so the inbox can dim it.
 */
export default async function TailorFromOpportunityPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: opportunityId } = await props.params;
  const org = await ensureOrgForUser(userId);

  const sql = getSql();
  const rows = (await sql`
    SELECT id, title, description, department, naics_code, set_aside,
           sam_url, notice_id,
           to_char(response_deadline, 'YYYY-MM-DD') AS response_deadline
    FROM sam_opportunities
    WHERE id = ${opportunityId} AND organization_id = ${org.id}
    LIMIT 1
  `) as Array<{
    id: string;
    title: string;
    description: string | null;
    department: string | null;
    naics_code: string | null;
    set_aside: string | null;
    sam_url: string | null;
    notice_id: string;
    response_deadline: string | null;
  }>;
  const opp = rows[0];
  if (!opp) notFound();

  // Mark viewed (best-effort).
  await sql`
    UPDATE sam_opportunities
    SET viewed_at = COALESCE(viewed_at, NOW())
    WHERE id = ${opportunityId} AND organization_id = ${org.id}
  `;

  const assessments = await listAssessmentsForOrg(org.id);
  if (assessments.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a06b1a]">
          No assessment yet
        </p>
        <h1 className="mt-2 font-serif text-2xl font-bold">
          Start your CMMC L1 self-assessment first
        </h1>
        <p className="mt-3 text-sm text-[#456c5f]">
          The packet sits on top of your assessment. Once you have one going,
          tailoring takes seconds.
        </p>
        <Link
          href="/assessments"
          className="mt-6 inline-block rounded-sm bg-[#10231d] px-5 py-2.5 text-sm font-bold text-white"
        >
          Go to Workspace
        </Link>
      </main>
    );
  }
  const assessmentId = assessments[0].id;
  const profile = await loadBidProfile(org.id);

  // Build initial textarea content: title + key metadata + description.
  const lines: string[] = [];
  lines.push(opp.title);
  const meta = [opp.department, opp.naics_code, opp.set_aside]
    .filter(Boolean)
    .join(" · ");
  if (meta) lines.push(meta);
  if (opp.response_deadline) lines.push(`Response due: ${opp.response_deadline}`);
  if (opp.sam_url) lines.push(`SAM.gov: ${opp.sam_url}`);
  if (opp.description) {
    lines.push("");
    lines.push(opp.description);
  }
  const initialOpportunity = lines.join("\n");
  const labelDept = opp.department ? `${opp.department} · ` : "";
  const labelNaics = opp.naics_code ? `NAICS ${opp.naics_code} · ` : "";
  const initialLabel =
    `${labelDept}${labelNaics}${opp.title}`.slice(0, 140);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/opportunities"
          className="text-xs font-semibold text-[#2f8f6d] hover:underline"
        >
          ← Back to opportunity inbox
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Tailored packet · pre-filled from SAM.gov
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          {opp.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          We pre-filled the solicitation text from SAM.gov. Click <strong>Tailor with Charlie</strong>{" "}
          and we&apos;ll rewrite your capability statement to match this
          agency&apos;s exact language. Edit the draft, then generate.
        </p>
      </header>

      <TailorForm
        assessmentId={assessmentId}
        masterCapability={profile.capability_statement}
        masterDifferentiators={profile.differentiators}
        tailorAction={tailorOpportunityAction}
        initialOpportunity={initialOpportunity}
        initialOpportunityLabel={initialLabel}
      />
    </main>
  );
}
