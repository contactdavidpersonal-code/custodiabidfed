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
  [PLAN_SELF_SERVICE]: {
    slug: PLAN_SELF_SERVICE,
    title: "CMMC Level 1 — Self Service",
    badge: "Solo · Self Service",
    price: "$249",
    priceSuffix: "/mo after trial · $2,496/yr on annual",
    capLine: "1 business · 14 days free, no card",
    ctaText: "Start my 14-day free trial",
    bullets: SELF_SERVICE_BULLETS,
    hasFeatureKey: PLAN_SELF_SERVICE,
  },
  [PLAN_SELF_SERVICE_OFFICER]: {
    slug: PLAN_SELF_SERVICE_OFFICER,
    title: "CMMC Level 1 — Self Service + Custodia Officer",
    badge: "Solo · + Custodia Officer",
    price: "$397",
    priceSuffix: "/mo after trial · $3,996/yr on annual",
    capLine: "1 business · Officer assigned to your account · 14 days free, no card",
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
  const isSolo = isSoloSelfService || isSoloOfficer;

  // For solo flows we stack a second card with the "other" solo plan.
  // MSP flows stay compact (one card, small links).
  const secondaryCfg = isSoloSelfService
    ? PLAN_CONFIG[PLAN_SELF_SERVICE_OFFICER]
    : isSoloOfficer
      ? PLAN_CONFIG[PLAN_SELF_SERVICE]
      : null;

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
                {isMsp ? "MSP control room" : "CMMC Level 1 workspace"}
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
            {isSoloSelfService
              ? "Save two months on annual · 14 days free, no card"
              : "14 days free · No credit card required"}
          </div>
          <h1 className="font-serif text-3xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl">
            {isMsp
              ? "Start your Custodia MSP trial."
              : "Start your 14-day free trial."}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#a8cfc0]">
            {isMsp
              ? "Full Custodia MSP workspace — multi-tenant, vCO-walked. No card until day 14, only if you stay."
              : "Full Custodia workspace — CMMC Level 1 build, freshness alerts, Charlie on call. No card until day 14, only if you stay."}
          </p>
        </div>

        {isSolo ? (
          <div className="space-y-5">
            <PlanCard cfg={cfg} primary highlight={isSoloSelfService} />
            {secondaryCfg ? (
              <PlanCard cfg={secondaryCfg} primary={false} />
            ) : null}

          </div>
        ) : (
          <PlanCard cfg={cfg} primary compact>
            <p className="mt-4 border-t border-[#e3dcc7] pt-3 text-center text-[11px] text-[#5a7f72]">
              Want the solo plan instead?{" "}
              <Link
                href={`/upgrade?plan=${PLAN_SELF_SERVICE}`}
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
                Self Service — $249/mo
              </Link>
              {" · "}
              <Link
                href={`/upgrade?plan=${PLAN_SELF_SERVICE_OFFICER}`}
                className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
              >
                + Custodia Officer — $397/mo
              </Link>
            </p>
          </PlanCard>
        )}

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

function PlanCard({
  cfg,
  primary,
  highlight = false,
  compact = false,
  children,
}: {
  cfg: (typeof PLAN_CONFIG)[PlanKey];
  primary: boolean;
  highlight?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={
        "relative border bg-[#f7f4ea] p-6 md:p-8 shadow-[0_2px_0_rgba(5,46,34,0.06),0_30px_80px_-20px_rgba(0,0,0,0.55)] " +
        (primary ? "border-[#d9d2bd]" : "border-[#d9d2bd]/70")
      }
    >
      {highlight && (
        <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 border border-[#2f8f6d]/40 bg-[#0e2a23] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          <span
            aria-hidden
            className="inline-block h-1 w-1 rounded-full bg-[#bdf2cf]"
          />
          Save two months on annual
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a06b1a]">
        {cfg.badge}
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        {cfg.strikePrice && (
          <span className="font-serif text-xl text-[#7a8a82] line-through decoration-[#a06b1a] decoration-2">
            {cfg.strikePrice}
          </span>
        )}
        <span className="font-serif text-4xl font-bold tracking-tight text-[#0e2a23] md:text-5xl">
          {cfg.price}
        </span>
        <span className="text-xs text-[#5a7f72]">{cfg.priceSuffix}</span>
        <span className="ml-auto text-[11px] font-semibold text-[#1d6a4a]">
          {cfg.capLine}
        </span>
      </div>
      {highlight && (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f8f6d]">
          $2,496/yr on annual — two months free
        </p>
      )}
      <p className="mt-3 font-serif text-lg font-semibold text-[#0e2a23]">
        {cfg.title}
      </p>

      <ul
        className={
          "mt-4 grid grid-cols-1 gap-x-5 gap-y-1.5 text-[13px] text-[#2c4940] " +
          (compact ? "" : "sm:grid-cols-2")
        }
      >
        {cfg.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 font-bold text-[#2f8f6d]">
              &#10003;
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <TrialCheckoutButton
          planId={cfg.slug}
          className={
            "group flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-bold transition-colors " +
            (primary
              ? "bg-[#bef4be] text-[#063f2e] shadow-[0_15px_40px_-10px_rgba(190,244,190,0.45)] hover:bg-[#a8e6c0]"
              : "border border-[#0e2a23] bg-transparent text-[#0e2a23] hover:bg-[#0e2a23] hover:text-[#bef4be]")
          }
        >
          {cfg.ctaText}
          <span
            aria-hidden
            className="text-base transition-transform group-hover:translate-x-0.5"
          >
            &rarr;
          </span>
        </TrialCheckoutButton>
        <p className="mt-2 text-center text-[11px] text-[#5a7f72]">
          No charge for 14 days &middot; Cancel anytime
        </p>
      </div>

      {children}
    </div>
  );
}
