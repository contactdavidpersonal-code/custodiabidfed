import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ensureOrgForUser,
  getBusinessProfile,
  isOnboardingComplete,
} from "@/lib/assessment";
import { OnboardingChat } from "./OnboardingChat";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  const profile = await getBusinessProfile(org.id);
  if (isOnboardingComplete(org, profile)) {
    redirect("/assessments");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-amber-400">
              C
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
                Custodia
              </div>
              <div className="text-sm font-bold text-slate-900">
                Let&apos;s get to know your business
              </div>
            </div>
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </header>
      <main className="flex flex-1 justify-center px-6 py-8">
        <div className="flex w-full max-w-3xl flex-col">
          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
              Step 1 · Onboarding
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Talk to your compliance officer.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
              A short conversation about what your business does and where federal
              contract info lives. The officer writes everything into your profile
              as you go — no forms — so the rest of the workspace is tailored to
              you from the first click.
            </p>
          </section>
          <OnboardingChat initialCompleteness={profile?.completeness_score ?? 0} />
        </div>
      </main>
    </div>
  );
}
