import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrialCheckoutButton } from "./TrialCheckoutButton";

const SOLO_PLAN_SLUG = "cmmc_lv1_full_access";

type PlanKey = "msp_squad_5" | "msp_platoon_20" | "cmmc_lv1_full_access";

const PLAN_CONFIG: Record<PlanKey, {
  slug: string;
  title: string;
  badge: string;
  price: string;
  priceSuffix: string;
  capLine: string;
  ctaText: string;
  bullets: string[];
  hasFeatureKey: string;
}> = {
  msp_squad_5: {
    slug: "msp_squad_5",
    title: "Squad — manage up to 5 client businesses",
    badge: "MSP · Squad",
    price: "$499",
    priceSuffix: "/mo after trial",
    capLine: "Up to 5 client businesses · 14 days free, no card",
    ctaText: "Start my Squad trial",
    bullets: [
      "Up to 5 client businesses managed from one login",
      "All 15 FAR 52.204-21 controls walked per client by Charlie, your vCO",
      "Bid-ready package per client: SSP, affirmation, evidence",
      "Year-round M365/Google monitoring across every client",
      "Annual SPRS re-affirmation handled per client",
      "Officer-reviewed before any client submits",
      "BONUS: Daily Discover (SAM.gov bids matched to each client's NAICS)",
      "BONUS: Monday Bid Digest emailed weekly",
    ],
    hasFeatureKey: "msp_squad_5",
  },
  msp_platoon_20: {
    slug: "msp_platoon_20",
    title: "Platoon — manage up to 20 client businesses",
    badge: "MSP · Platoon",
    price: "$1,499",
    priceSuffix: "/mo after trial",
    capLine: "Up to 20 client businesses · 14 days free, no card",
    ctaText: "Start my Platoon trial",
    bullets: [
      "Up to 20 client businesses managed from one login",
      "Everything in Squad, scaled to a full client roster",
      "Year-round M365/Google monitoring across every client",
      "Annual SPRS re-affirmation handled per client",
      "Officer-reviewed before any client submits",
      "Priority support",
      "BONUS: Daily Discover per client",
      "BONUS: Monday Bid Digest emailed weekly",
    ],
    hasFeatureKey: "msp_platoon_20",
  },
  cmmc_lv1_full_access: {
    slug: SOLO_PLAN_SLUG,
    title: "CMMC Level 1 — Solo",
    badge: "Solo operator",
    price: "$449",
    priceSuffix: "/mo after trial",
    capLine: "1 business · 14 days free, no card",
    ctaText: "Start my 14-day free trial",
    bullets: [
      "All 15 FAR 52.204-21 safeguarding requirements walked by Charlie",
      "Bid-ready package: SSP, affirmation, evidence",
      "Year-round M365 / Google Workspace monitoring",
      "Evidence freshness alerts",
      "Annual SPRS re-affirmation handled",
      "Officer-reviewed before you submit",
      "BONUS: Daily Discover — 15 fresh SAM.gov bids/day matched to your NAICS",
      "BONUS: Monday Bid Digest emailed weekly",
    ],
    hasFeatureKey: SOLO_PLAN_SLUG,
  },
};

function isPlanKey(value: string | undefined): value is PlanKey {
  return (
    value === "msp_squad_5" ||
    value === "msp_platoon_20" ||
    value === "cmmc_lv1_full_access"
  );
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");

  const { plan: planParam } = await searchParams;
  const planKey: PlanKey = isPlanKey(planParam) ? planParam : "cmmc_lv1_full_access";
  const cfg = PLAN_CONFIG[planKey];

  // If the user already has active access (paid OR active trial) on the
  // requested plan, send them to the workspace.
  if (has({ plan: `user:${cfg.hasFeatureKey}` })) redirect("/onboard");
  // If they already have a higher-tier MSP plan, also let them through.
  if (planKey !== "msp_platoon_20" && has({ plan: "user:msp_platoon_20" })) {
    redirect("/onboard");
  }

  const isMsp = planKey === "msp_squad_5" || planKey === "msp_platoon_20";

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-7 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia
              </div>
              <div className="font-serif text-xs font-bold text-[#10231d]">
                {isMsp ? "MSP control room" : "CMMC Level 1 workspace"}
              </div>
            </div>
          </Link>
          <Link
            href={isMsp ? "/for-msps" : "/"}
            className="text-xs font-medium text-[#456c5f] transition-colors hover:text-[#10231d]"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-5 text-center">
          <div className="mb-2 inline-flex items-center gap-2 border border-[#bdf2cf] bg-[#eaf7ef] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1d6a4a]">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[#1d6a4a]" />
            14 days free &middot; No credit card required
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
            {isMsp
              ? "Start your Custodia MSP trial. Onboard your first client business in minutes."
              : "Start your 14-day free trial. Get bid-ready without paying a cent."}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-snug text-[#4a7164]">
            {isMsp
              ? "Full Custodia MSP workspace — multi-tenant, vCO-walked, officer-reviewed. No card until day 14, only if you stay."
              : "Full Custodia workspace — CMMC Level 1 build, freshness alerts, vCO on call. No card until day 14, only if you stay."}
          </p>
        </div>

        <div className="border border-[#cfe3d9] bg-white p-5 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a06b1a]">
            {cfg.badge}
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="font-serif text-3xl font-bold text-[#10231d]">{cfg.price}</span>
            <span className="text-xs text-[#5a7f72]">{cfg.priceSuffix}</span>
            <span className="ml-auto text-[11px] font-semibold text-[#1d6a4a]">{cfg.capLine}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#10231d]">{cfg.title}</p>

          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] text-[#2c4940] sm:grid-cols-2">
            {cfg.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">&#10003;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <TrialCheckoutButton
              planId={cfg.slug}
              className="group flex w-full items-center justify-center gap-2 bg-[#0e2a23] px-5 py-3 text-sm font-bold text-[#bdf2cf] shadow-[0_10px_30px_-10px_rgba(14,42,35,0.6)] transition-colors hover:bg-[#10342a]"
            >
              {cfg.ctaText}
              <span aria-hidden className="text-base transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </TrialCheckoutButton>
            <p className="mt-1.5 text-center text-[11px] text-[#5a7f72]">
              No charge for 14 days &middot; Cancel anytime
            </p>
          </div>

          {isMsp ? (
            <p className="mt-4 border-t border-[#e3eee7] pt-3 text-center text-[11px] text-[#5a7f72]">
              Want the solo plan instead?{" "}
              <Link href="/upgrade?plan=cmmc_lv1_full_access" className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]">
                Single business — $449/mo
              </Link>
            </p>
          ) : (
            <p className="mt-4 border-t border-[#e3eee7] pt-3 text-center text-[11px] text-[#5a7f72]">
              Manage multiple clients?{" "}
              <Link href="/for-msps" className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]">
                See MSP plans
              </Link>
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-[#5a7f72]">
          Questions before you start?{" "}
          <a
            href="mailto:support@custodia.dev"
            className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
          >
            support@custodia.dev
          </a>
        </p>
      </main>
    </div>
  );
}
