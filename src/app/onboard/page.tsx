import { CreateOrganization, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ensureOrgForUser,
  getActiveOrgFromAuth,
  getBusinessProfile,
  isOnboardingComplete,
} from "@/lib/assessment";
import { hasMspAccess, hasSoloAccess } from "@/lib/billing/plans";
import { ensureWelcomeEmailSent } from "@/lib/email/welcome";
import { OnboardingChat } from "./OnboardingChat";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const { userId, has, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const isMsp = hasMspAccess(has);
  const isSolo = hasSoloAccess(has);

  // No active plan/trial → upgrade gate.
  if (!isMsp && !isSolo) redirect("/upgrade");

  // MSPs without an active Clerk org → prompt them to create their first
  // client business. They cannot operate on a personal account; every
  // workspace is an org.
  if (isMsp && !orgId) {
    return (
      <div className="flex min-h-screen flex-col bg-[#e9efea] text-[#10231d]">
        <header className="flex-none border-b border-[#cfe3d9] bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/custodia-logo.png"
                alt="Custodia shield"
                className="h-9 w-auto"
              />
              <div className="leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                  Custodia MSP &middot; Step 1
                </div>
                <div className="font-serif text-sm font-bold text-[#10231d]">
                  Create your first client business
                </div>
              </div>
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 py-8">
          <div className="mb-5 max-w-2xl text-center">
            <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
              Welcome aboard. Let&apos;s onboard your first client.
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-snug text-[#4a7164]">
              Each business you manage gets its own workspace — its own SSP,
              affirmation, evidence, and SPRS record. Add your first client
              business below to get started. You can add more from the header
              switcher anytime.
            </p>
          </div>
          <CreateOrganization
            afterCreateOrganizationUrl="/onboard"
            skipInvitationScreen
          />
        </main>
      </div>
    );
  }

  // From here we're either solo (Personal account) or MSP with an active org.
  const org = isMsp
    ? (await getActiveOrgFromAuth()) ?? (await ensureOrgForUser(userId))
    : await ensureOrgForUser(userId);
  await ensureWelcomeEmailSent(org.id, userId);
  const profile = await getBusinessProfile(org.id);
  if (isOnboardingComplete(org, profile)) {
    redirect("/assessments");
  }

  return (
    <div className="flex h-screen flex-col bg-[#e9efea] text-[#10231d]">
      <header className="flex-none border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-9 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia · Step 1 of 3
              </div>
              <div className="font-serif text-sm font-bold text-[#10231d]">
                Talk to your compliance officer
              </div>
            </div>
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 justify-center px-6 py-4">
        <div className="flex min-h-0 w-full max-w-5xl flex-col">
          <OnboardingChat initialCompleteness={profile?.completeness_score ?? 0} />
        </div>
      </main>
    </div>
  );
}
