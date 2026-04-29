import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAssessmentForUser } from "@/lib/assessment";
import { loadBidProfile } from "@/lib/bid-profile";
import { TailorForm } from "./TailorForm";
import { tailorOpportunityAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TailorPacketPage(
  props: PageProps<"/assessments/[id]/bid-packet/tailor">,
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await props.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) notFound();

  const profile = await loadBidProfile(ctx.organization.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <Link
          href={`/assessments/${id}/bid-packet`}
          className="text-xs font-semibold text-[#2f8f6d] hover:underline"
        >
          ← Back to packet
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
          Tailor for an opportunity
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#10231d] md:text-4xl">
          One-time custom packet
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5a7d70]">
          Paste a SAM.gov notice, scope of work, or solicitation text below.
          We&apos;ll rewrite your capability statement and differentiators to
          map to the language of that specific opportunity — without touching
          your master profile. Edit the AI draft, then generate.
        </p>
        <p className="mt-2 max-w-2xl text-xs text-[#456c5f]">
          Your master profile stays clean. Each tailored packet is a fresh
          one-shot — re-run this anytime for a new opportunity.
        </p>
      </header>

      <TailorForm
        assessmentId={id}
        masterCapability={profile.capability_statement}
        masterDifferentiators={profile.differentiators}
        tailorAction={tailorOpportunityAction}
      />
    </main>
  );
}
