import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ensureOrgForUser,
  getBusinessProfile,
  isOnboardingComplete,
} from "@/lib/assessment";
import { ensureWelcomeEmailSent } from "@/lib/email/welcome";
import { OnboardingChat } from "./OnboardingChat";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");
  if (!has({ plan: "user:cmmc_lv1_full_access" })) redirect("/upgrade");

  const org = await ensureOrgForUser(userId);
  await ensureWelcomeEmailSent(org.id, userId);
  const profile = await getBusinessProfile(org.id);
  if (isOnboardingComplete(org, profile)) {
    redirect("/assessments");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex-none border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-amber-400">
              C
            </span>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
                Custodia · Step 1 of 3
              </div>
              <div className="text-sm font-bold text-slate-900">
                Talk to your compliance officer
              </div>
            </div>
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 justify-center px-6 py-4">
        <div className="flex min-h-0 w-full max-w-3xl flex-col">
          <OnboardingChat initialCompleteness={profile?.completeness_score ?? 0} />
        </div>
      </main>
    </div>
  );
}
