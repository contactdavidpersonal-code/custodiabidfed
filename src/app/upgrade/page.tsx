import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PLAN_PLATOON,
  PLAN_SELF_SERVICE,
  PLAN_SELF_SERVICE_OFFICER,
  PLAN_SQUAD,
} from "@/lib/billing/plans";
import { TrialCheckoutButton } from "./TrialCheckoutButton";

type PlanKey =
  | typeof PLAN_SQUAD
  | typeof PLAN_PLATOON
  | typeof PLAN_SELF_SERVICE
  | typeof PLAN_SELF_SERVICE_OFFICER;

const SELF_SERVICE_BULLETS = [
  "Charlie, your virtual Compliance Officer, 24/7",
  "All 15 FAR 52.204-21 safeguarding requirements walked",
  "Bid-ready package: SSP, affirmation, evidence",
  "Year-round M365 / Google Workspace monitoring",
  "Evidence freshness alerts (green/yellow/red)",
  "Annual SPRS re-affirmation handled",
  "Signed, hash-anchored artifact pack",
  "Public Trust Page (opt-in)",
  "BONUS: Daily Discover — 15 fresh SAM.gov bids/day",
  "BONUS: Monday Bid Digest emailed weekly",
];

const OFFICER_BULLETS = [
  "Everything in Self Service, plus:",
  "Ask a credentialed Custodia Compliance Officer anytime",
  "Officer ticket inbox — answers thread back into the platform",
  "Officer-led audit support: same-day prep + evidence pack",
  "Officer review before you submit or affirm",
  "Priority escalation when Charlie flags something complex",
];

const PLAN_CONFIG: Record<
  PlanKey,
  {
    slug: string;
    title: string;
    badge: string;
    price: string;
    strikePrice?: string;
    priceSuffix: string;
    capLine: string;
    ctaText: string;
    bullets: string[];
    hasFeatureKey: string;
  }
> = {
  custodia_squad: {
    slug: PLAN_SQUAD,
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
      "BONUS: Daily Discover (SAM.gov bids matched to each client's NAICS)",
      "BONUS: Monday Bid Digest emailed weekly",
    ],
    hasFeatureKey: PLAN_SQUAD,
  },
  msp_platoon_20: {
    slug: PLAN_PLATOON,
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
      "Priority support",
      "BONUS: Daily Discover per client",
      "BONUS: Monday Bid Digest emailed weekly",
    ],
    hasFeatureKey: PLAN_PLATOON,
  },
  bidfedcmmc_self_service: {
    slug: PLAN_SELF_SERVICE,
    title: "CMMC Level 1 — Self Service",
    badge: "Solo · Self Service",
    price: "$149",
    strikePrice: "$197",
    priceSuffix: "/mo after trial",
    capLine: "1 business · 14 days free, no card",
    ctaText: "Start my 14-day free trial",
    bullets: SELF_SERVICE_BULLETS,
    hasFeatureKey: PLAN_SELF_SERVICE,
  },
  bidfedcmmc_self_service_custodia_officer: {
    slug: PLAN_SELF_SERVICE_OFFICER,
    title: "CMMC Level 1 — Self Service + Custodia Officer",
    badge: "Solo · + Custodia Officer",
    price: "$297",
    priceSuffix: "/mo after trial",
    capLine: "1 business · Human officer included · 14 days free, no card",
    ctaText: "Start my 14-day free trial",
    bullets: OFFICER_BULLETS,
    hasFeatureKey: PLAN_SELF_SERVICE_OFFICER,
  },
};

function isPlanKey(value: string | undefined): value is PlanKey {
  return (
    value === PLAN_SQUAD ||
    value === PLAN_PLATOON ||
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

  const { plan: planParam } = await searchParams;
  const planKey: PlanKey = isPlanKey(planParam) ? planParam : PLAN_SELF_SERVICE;
  const cfg = PLAN_CONFIG[planKey];

  // If the user already has active access (paid OR active trial) on the
  // requested plan, send them to the workspace.
  if (has({ plan: `user:${cfg.hasFeatureKey}` })) redirect("/onboard");
  // Higher-tier plans satisfy lower-tier checks.
  if (planKey !== PLAN_PLATOON && has({ plan: `user:${PLAN_PLATOON}` })) {
    redirect("/onboard");
  }
  if (
    planKey === PLAN_SELF_SERVICE &&
    has({ plan: `user:${PLAN_SELF_SERVICE_OFFICER}` })
  ) {
    redirect("/onboard");
  }

  const isMsp = planKey === PLAN_SQUAD || planKey === PLAN_PLATOON;
  const isSoloSelfService = planKey === PLAN_SELF_SERVICE;
  const isSoloOfficer = planKey === PLAN_SELF_SERVICE_OFFICER;

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
            href={isMsp ? "/for-msps" : "/pricing"}
            className="text-xs font-medium text-[#456c5f] transition-colors hover:text-[#10231d]"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-5 text-center">
          <div className="mb-2 inline-flex items-center gap-2 border border-[#bdf2cf] bg-[#eaf7ef] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1d6a4a]">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#1d6a4a]"
            />
            {isSoloSelfService
              ? "Fiscal-Year Compliance Special · 14 days free, no card"
              : "14 days free · No credit card required"}
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#10231d] md:text-3xl">
            {isMsp
              ? "Start your Custodia MSP trial. Onboard your first client business in minutes."
              : "Start your 14-day free trial. Get bid-ready without paying a cent."}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-snug text-[#4a7164]">
            {isMsp
              ? "Full Custodia MSP workspace — multi-tenant, vCO-walked. No card until day 14, only if you stay."
              : "Full Custodia workspace — CMMC Level 1 build, freshness alerts, Charlie on call. No card until day 14, only if you stay."}
          </p>
        </div>

        <div className="border border-[#cfe3d9] bg-white p-5 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a06b1a]">
            {cfg.badge}
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            {cfg.strikePrice && (
              <span className="font-serif text-lg text-[#5a7f72] line-through decoration-[#c4543a] decoration-2">
                {cfg.strikePrice}
              </span>
            )}
            <span className="font-serif text-3xl font-bold text-[#10231d]">
              {cfg.price}
            </span>
            <span className="text-xs text-[#5a7f72]">{cfg.priceSuffix}</span>
            <span className="ml-auto text-[11px] font-semibold text-[#1d6a4a]">
              {cfg.capLine}
            </span>
          </div>
          {isSoloSelfService && (
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c4543a]">
              Fiscal-Year Compliance Special — locked through FY end (Sept 30)
            </p>
          )}
          <p className="mt-2 text-sm font-semibold text-[#10231d]">
            {cfg.title}
          </p>

          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] text-[#2c4940] sm:grid-cols-2">
            {cfg.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">
                  &#10003;
                </span>
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
              <span
                aria-hidden
                className="text-base transition-transform group-hover:translate-x-0.5"
              >
                &rarr;
              </span>
            </TrialCheckoutButton>
            <p className="mt-1.5 text-center text-[11px] text-[#5a7f72]">
              No charge for 14 days &middot; Cancel anytime
            </p>
          </div>

          {isMsp && (
            <p className="mt-4 border-t border-[#e3eee7] pt-3 text-center text-[11px] text-[#5a7f72]">
              Want the solo plan instead?{" "}
              <Link
                href={`/upgrade?plan=${PLAN_SELF_SERVICE}`}
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
                Self Service — $149/mo
              </Link>
              {" · "}
              <Link
                href={`/upgrade?plan=${PLAN_SELF_SERVICE_OFFICER}`}
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
                + Custodia Officer — $297/mo
              </Link>
            </p>
          )}

          {isSoloSelfService && (
            <p className="mt-4 border-t border-[#e3eee7] pt-3 text-center text-[11px] text-[#5a7f72]">
              Want a credentialed human Compliance Officer on call?{" "}
              <Link
                href={`/upgrade?plan=${PLAN_SELF_SERVICE_OFFICER}`}
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
                Add Custodia Officer — $297/mo
              </Link>
            </p>
          )}

          {isSoloOfficer && (
            <p className="mt-4 border-t border-[#e3eee7] pt-3 text-center text-[11px] text-[#5a7f72]">
              Just need the platform without a human officer?{" "}
              <Link
                href={`/upgrade?plan=${PLAN_SELF_SERVICE}`}
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
                Self Service — $149/mo
              </Link>
            </p>
          )}

          {!isMsp && (
            <p className="mt-2 text-center text-[11px] text-[#5a7f72]">
              Manage multiple clients?{" "}
              <Link
                href="/for-msps"
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
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
