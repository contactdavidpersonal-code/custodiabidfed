import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PLAN_SELF_SERVICE,
  PLAN_SELF_SERVICE_OFFICER,
} from "@/lib/billing/plans";
import { PlanCards } from "./PlanCards";

type PlanKey =
  | typeof PLAN_SELF_SERVICE
  | typeof PLAN_SELF_SERVICE_OFFICER;

function isPlanKey(value: string | undefined): value is PlanKey {
  return (
    value === PLAN_SELF_SERVICE ||
    value === PLAN_SELF_SERVICE_OFFICER
  );
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");

  const { plan: rawPlanParam } = await searchParams;
  // Backward-compat: older links use slugs without the trailing underscore
  // that the Clerk plan slugs actually carry.
  const planParam =
    rawPlanParam === "bidfedcmmc_self_service"
      ? PLAN_SELF_SERVICE
      : rawPlanParam === "bidfedcmmc_self_service_custodia_officer"
        ? PLAN_SELF_SERVICE_OFFICER
        : rawPlanParam;
  const planKey: PlanKey = isPlanKey(planParam) ? planParam : PLAN_SELF_SERVICE;

  // If the user already has active access (paid OR active trial) on the
  // requested plan, send them to the workspace.
  if (has({ plan: `user:${planKey}` })) redirect("/onboard");
  if (
    planKey === PLAN_SELF_SERVICE &&
    has({ plan: `user:${PLAN_SELF_SERVICE_OFFICER}` })
  ) {
    redirect("/onboard");
  }

  return (
    <div className="min-h-screen bg-[#052e22] text-[#f6f4ec]">
      <header className="border-b border-white/10 bg-[#052e22]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-7 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
                Custodia
              </div>
              <div className="font-serif text-xs font-semibold text-white">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-[#a8cfc0] transition-colors hover:text-white"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 border border-[#bdf2cf]/40 bg-[#063f2e]/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#bef4be]"
            />
            14 days free · No credit card · Yearly saves 2 months
          </div>
          <h1 className="font-serif text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl">
            Start your 14-day free trial.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#a8cfc0]">
            Full Custodia workspace — CMMC Level 1 build, freshness alerts, Charlie on call. No card until day 14, only if you stay.
          </p>
        </div>

        <PlanCards primaryPlan={planKey} />

        <p className="mt-6 text-center text-[11px] text-[#7fae9c]">
          Questions before you start?{" "}
          <a
            href="mailto:support@custodia.dev"
            className="font-medium text-[#bdf2cf] underline underline-offset-2 hover:text-white"
          >
            support@custodia.dev
          </a>
        </p>
      </main>
    </div>
  );
}
