import { CreateOrganization } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Themed in-app replacement for Clerk's hosted "choose-organization" task page
 * (which lives at accounts.bidfedcmmc.com and ships in default Clerk purple).
 *
 * The Clerk session-task URL for `choose-organization` is set to this route in
 * the Clerk dashboard so users stay on-brand through the entire onboarding
 * flow. The <CreateOrganization /> component inherits brand colors and type
 * from <ClerkProvider appearance={clerkAppearance}> in src/app/layout.tsx.
 */
export default async function OnboardOrganizationPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  // If they already have an active org, push straight into onboarding.
  if (orgId) redirect("/onboard");

  return (
    <main className="min-h-screen bg-[#0e2a23] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-md">
          <Link
            href="/"
            className="font-serif text-xl font-bold tracking-tight text-white hover:text-[#bdf2cf]"
          >
            Custodia<span className="text-[#8dd2b1]">.</span>
          </Link>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
            Step 1 · Name your business
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            Set up your{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              compliance workspace
            </span>
            .
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#a8cfc0]">
            This is the workspace Charlie, your virtual Compliance Officer, will
            use to track your FAR 52.204-21 evidence, SSP drafts, and SPRS
            affirmations. Use your legal entity name — it carries into the
            bid-ready package.
          </p>
          <ul className="mt-5 space-y-1.5 text-xs text-[#cce5da]">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">
                &#10003;
              </span>
              <span>Private to you — not shared with other Custodia tenants.</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">
                &#10003;
              </span>
              <span>You can rename it later from Settings.</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">
                &#10003;
              </span>
              <span>Logo is optional — it appears on generated deliverables.</span>
            </li>
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">
          <CreateOrganization
            afterCreateOrganizationUrl="/onboard"
            skipInvitationScreen
          />
        </div>
      </div>
    </main>
  );
}
