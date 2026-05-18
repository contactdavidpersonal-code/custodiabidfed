"use client";

/**
 * Plan cards + billing-period toggle for /upgrade.
 *
 * Annual is the default — we lead with the yearly price (two months free)
 * and show the monthly equivalent as supporting text. A pill switch lets
 * the user flip to monthly billing, which swaps both the headline price
 * and the price passed into Clerk's checkout via TrialCheckoutButton.
 */

import { useState } from "react";
import {
  PLAN_SELF_SERVICE,
  PLAN_SELF_SERVICE_OFFICER,
} from "@/lib/billing/plans";
import { TrialCheckoutButton } from "./TrialCheckoutButton";

type PlanKey =
  | typeof PLAN_SELF_SERVICE
  | typeof PLAN_SELF_SERVICE_OFFICER;

type BillingPeriod = "annual" | "month";

type PlanCfg = {
  slug: PlanKey;
  title: string;
  badge: string;
  // Monthly billing
  monthlyPrice: string;
  // Annual billing
  annualPrice: string;
  annualEffectiveMonthly: string;
  annualSavings: string;
  capLine: string;
  ctaText: string;
  bullets: string[];
};

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

const SELF_SERVICE_CFG: PlanCfg = {
  slug: PLAN_SELF_SERVICE,
  title: "CMMC Level 1 — Self Service",
  badge: "Solo · Self Service",
  monthlyPrice: "$249",
  annualPrice: "$2,496",
  annualEffectiveMonthly: "$208",
  annualSavings: "Save $492/yr — two months free",
  capLine: "1 business · 14 days free, no card",
  ctaText: "Start my 14-day free trial",
  bullets: SELF_SERVICE_BULLETS,
};

const OFFICER_CFG: PlanCfg = {
  slug: PLAN_SELF_SERVICE_OFFICER,
  title: "CMMC Level 1 — Self Service + Custodia Officer",
  badge: "Solo · + Custodia Officer",
  monthlyPrice: "$397",
  annualPrice: "$3,996",
  annualEffectiveMonthly: "$333",
  annualSavings: "Save $768/yr — two months free",
  capLine: "1 business · Officer assigned · 14 days free, no card",
  ctaText: "Start my 14-day free trial",
  bullets: OFFICER_BULLETS,
};

export function PlanCards({
  primaryPlan,
}: {
  primaryPlan: PlanKey;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("annual");

  const primaryCfg =
    primaryPlan === PLAN_SELF_SERVICE_OFFICER ? OFFICER_CFG : SELF_SERVICE_CFG;
  const secondaryCfg =
    primaryPlan === PLAN_SELF_SERVICE_OFFICER ? SELF_SERVICE_CFG : OFFICER_CFG;

  return (
    <div className="space-y-5">
      <BillingToggle period={period} onChange={setPeriod} />
      <PlanCard cfg={primaryCfg} period={period} primary highlight />
      <PlanCard cfg={secondaryCfg} period={period} primary={false} />
    </div>
  );
}

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  return (
    <div className="flex justify-center">
      <div
        role="tablist"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-[#bdf2cf]/30 bg-[#063f2e]/60 p-1 text-[12px] font-semibold"
      >
        <button
          type="button"
          role="tab"
          aria-selected={period === "annual"}
          onClick={() => onChange("annual")}
          className={
            "flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors " +
            (period === "annual"
              ? "bg-[#bef4be] text-[#063f2e]"
              : "text-[#a8cfc0] hover:text-white")
          }
        >
          Yearly
          <span
            className={
              "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] " +
              (period === "annual"
                ? "bg-[#063f2e] text-[#bef4be]"
                : "bg-[#bdf2cf]/15 text-[#bdf2cf]")
            }
          >
            2 mo free
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === "month"}
          onClick={() => onChange("month")}
          className={
            "rounded-full px-4 py-1.5 transition-colors " +
            (period === "month"
              ? "bg-[#bef4be] text-[#063f2e]"
              : "text-[#a8cfc0] hover:text-white")
          }
        >
          Monthly
        </button>
      </div>
    </div>
  );
}

function PlanCard({
  cfg,
  period,
  primary,
  highlight = false,
}: {
  cfg: PlanCfg;
  period: BillingPeriod;
  primary: boolean;
  highlight?: boolean;
}) {
  const isAnnual = period === "annual";
  const headlinePrice = isAnnual ? cfg.annualEffectiveMonthly : cfg.monthlyPrice;
  const headlineSuffix = isAnnual
    ? "/mo · billed yearly"
    : "/mo · billed monthly";
  const supporting = isAnnual
    ? `${cfg.annualPrice}/yr after trial · ${cfg.annualSavings}`
    : `${cfg.monthlyPrice}/mo after trial · switch to yearly anytime to save two months`;

  return (
    <div
      className={
        "relative border bg-[#f7f4ea] p-6 md:p-8 shadow-[0_2px_0_rgba(5,46,34,0.06),0_30px_80px_-20px_rgba(0,0,0,0.55)] " +
        (primary ? "border-[#d9d2bd]" : "border-[#d9d2bd]/70")
      }
    >
      {highlight && isAnnual && (
        <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 border border-[#2f8f6d]/40 bg-[#0e2a23] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#bdf2cf]">
          <span
            aria-hidden
            className="inline-block h-1 w-1 rounded-full bg-[#bdf2cf]"
          />
          Best value · 2 months free
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a06b1a]">
        {cfg.badge}
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        {isAnnual && (
          <span className="font-serif text-xl text-[#7a8a82] line-through decoration-[#a06b1a] decoration-2">
            {cfg.monthlyPrice}
          </span>
        )}
        <span className="font-serif text-4xl font-bold tracking-tight text-[#0e2a23] md:text-5xl">
          {headlinePrice}
        </span>
        <span className="text-xs text-[#5a7f72]">{headlineSuffix}</span>
        <span className="ml-auto text-[11px] font-semibold text-[#1d6a4a]">
          {cfg.capLine}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f8f6d]">
        {supporting}
      </p>
      <p className="mt-3 font-serif text-lg font-semibold text-[#0e2a23]">
        {cfg.title}
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-1.5 text-[13px] text-[#2c4940] sm:grid-cols-2">
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
          planPeriod={period}
          className={
            "group flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-bold transition-colors " +
            (primary
              ? "bg-[#bef4be] text-[#063f2e] shadow-[0_15px_40px_-10px_rgba(190,244,190,0.45)] hover:bg-[#a8e6c0]"
              : "border border-[#0e2a23] bg-transparent text-[#0e2a23] hover:bg-[#0e2a23] hover:text-[#bef4be]")
          }
        >
          {cfg.ctaText}
          {isAnnual ? " (yearly)" : " (monthly)"}
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
    </div>
  );
}
