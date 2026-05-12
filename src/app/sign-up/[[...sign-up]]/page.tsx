import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const ALLOWED_PLANS = new Set([
  "custodia_squad",
  "msp_platoon_20",
  "bidfedcmmc_self_service",
  "bidfedcmmc_self_service_custodia_officer",
  // Legacy plan slug kept for grandfathered links.
  "cmmc_lv1_full_access",
]);

type PlanCopy = {
  eyebrow: string;
  headlinePrefix: string;
  headlineHighlight: string;
  headlineSuffix: string;
  sub: string;
  whyTitle: string;
  whyBody: string;
  bullets: { strong: string; rest: string }[];
  compare: { label: string; body: string; emphasis?: boolean }[];
  backHref: string;
  backLabel: string;
};

const SOLO_COPY: PlanCopy = {
  eyebrow: "14-day risk-free trial · No credit card",
  headlinePrefix: "Get bid-ready for ",
  headlineHighlight: "CMMC Level 1",
  headlineSuffix: " in days, not months.",
  sub: "Try the full platform free for 14 days — no credit card, no commitment. If it doesn't earn its keep, you don't pay a cent. Stay bid-eligible year-round on autopilot.",
  whyTitle: "Why CMMC Level 1 matters",
  whyBody:
    "FAR 52.204-21 is the floor for any federal contract touching FCI. No affirmation, no bid.",
  bullets: [
    { strong: "All 15 FAR 52.204-21 safeguarding requirements", rest: " walked by Charlie, your vCO" },
    { strong: "Bid-ready package generated", rest: " — SSP, affirmation memo, evidence" },
    { strong: "Year-round monitoring", rest: " via M365 or Google Workspace" },
    { strong: "Annual SPRS re-affirmation", rest: " handled on autopilot" },
    { strong: "Officer-reviewed", rest: " — no DIY guesswork" },
  ],
  compare: [
    { label: "DIY", body: "3–6 mo, $5k+, stale fast" },
    { label: "Audit firm", body: "$25k+, no monitoring" },
    { label: "Custodia", body: "Days, $149/mo, watched", emphasis: true },
  ],
  backHref: "/",
  backLabel: "← Back to home",
};

const SQUAD_COPY: PlanCopy = {
  eyebrow: "MSP · Squad · 14-day trial · No credit card",
  headlinePrefix: "Run CMMC Level 1 for ",
  headlineHighlight: "up to 5 client businesses",
  headlineSuffix: " from one login.",
  sub: "Squad gives you a multi-tenant control room — every client gets their own SSP, affirmation, evidence, and SPRS record, all walked by Charlie. 14 days free. No card until day 14.",
  whyTitle: "Why MSPs pick Squad",
  whyBody:
    "Stop juggling spreadsheets per client. One workspace, five tenants, officer-reviewed before any client submits.",
  bullets: [
    { strong: "Up to 5 client businesses", rest: " managed from one MSP login" },
    { strong: "Per-client SSP + affirmation + evidence", rest: " generated automatically" },
    { strong: "Year-round monitoring per client", rest: " on M365 or Google" },
    { strong: "Annual SPRS re-affirmation", rest: " handled per client" },
    { strong: "Daily Discover", rest: " — SAM.gov bids matched to each client's NAICS" },
  ],
  compare: [
    { label: "DIY per client", body: "3–6 mo each, $5k+ each" },
    { label: "Audit firm", body: "$25k+ per client" },
    { label: "Squad", body: "$499/mo · all 5 clients", emphasis: true },
  ],
  backHref: "/for-msps",
  backLabel: "← Back to MSP plans",
};

const PLATOON_COPY: PlanCopy = {
  ...SQUAD_COPY,
  eyebrow: "MSP · Platoon · 14-day trial · No credit card",
  headlinePrefix: "Run CMMC Level 1 for ",
  headlineHighlight: "up to 20 client businesses",
  headlineSuffix: " from one login.",
  sub: "Platoon scales the MSP control room to a full client roster. 14 days free. No card until day 14.",
  whyTitle: "Why MSPs pick Platoon",
  whyBody:
    "When five tenants is the floor, not the ceiling. Same officer-reviewed workflow, scaled to your whole book.",
  bullets: [
    { strong: "Up to 20 client businesses", rest: " managed from one MSP login" },
    { strong: "Everything in Squad", rest: ", scaled across the roster" },
    { strong: "Priority support", rest: " from a Custodia compliance officer" },
    { strong: "Per-client monitoring + SPRS", rest: " handled across the book" },
    { strong: "Daily Discover per client", rest: " — never miss a matched bid" },
  ],
  compare: [
    { label: "DIY per client", body: "3–6 mo each, $5k+ each" },
    { label: "Audit firm", body: "$25k+ per client" },
    { label: "Platoon", body: "$1,499/mo · 20 clients", emphasis: true },
  ],
};

const OFFICER_COPY: PlanCopy = {
  eyebrow: "+ Custodia Officer · 14-day trial · No credit card",
  headlinePrefix: "Get bid-ready for ",
  headlineHighlight: "CMMC Level 1",
  headlineSuffix: " — with a human Compliance Officer on call.",
  sub: "The full Self Service platform plus unlimited access to a credentialed Custodia Compliance Officer. Open a ticket anytime; replies thread back into the platform. 14 days free, no credit card.",
  whyTitle: "Why add a human officer",
  whyBody:
    "Charlie handles 95% of CMMC L1. The other 5% — odd boundaries, prime asks, audit chatter — is where a credentialed human earns their keep.",
  bullets: [
    { strong: "Everything in Self Service", rest: " — Charlie, evidence, SPRS, monitoring" },
    { strong: "Unlimited officer tickets", rest: " — written replies inside the platform" },
    { strong: "Officer-led audit support", rest: " — same-day prep + evidence pack" },
    { strong: "Officer review", rest: " before you submit or affirm" },
    { strong: "Priority escalation", rest: " when Charlie flags something complex" },
  ],
  compare: [
    { label: "DIY", body: "3–6 mo, $5k+, stale fast" },
    { label: "Audit firm", body: "$25k+, no monitoring" },
    { label: "Custodia + Officer", body: "Days, $297/mo, human-backed", emphasis: true },
  ],
  backHref: "/pricing",
  backLabel: "← Back to pricing",
};

function copyFor(plan: string | null): PlanCopy {
  if (plan === "custodia_squad") return SQUAD_COPY;
  if (plan === "msp_platoon_20") return PLATOON_COPY;
  if (plan === "bidfedcmmc_self_service_custodia_officer") return OFFICER_COPY;
  return SOLO_COPY;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const safePlan = plan && ALLOWED_PLANS.has(plan) ? plan : null;
  const redirectAfter = safePlan ? `/upgrade?plan=${safePlan}` : "/assessments";
  const signInHref = safePlan ? `/sign-in?plan=${safePlan}` : "/sign-in";
  const c = copyFor(safePlan);

  return (
    <main className="min-h-screen bg-[#0e2a23] px-6 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="font-serif text-xl font-bold tracking-tight text-white hover:text-[#bdf2cf]"
            >
              Custodia<span className="text-[#8dd2b1]">.</span>
            </Link>
            <Link
              href={c.backHref}
              className="text-[11px] font-medium text-[#8dd2b1] hover:text-white"
            >
              {c.backLabel}
            </Link>
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
            {c.eyebrow}
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            {c.headlinePrefix}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text pb-0.5 text-transparent">
              {c.headlineHighlight}
            </span>
            {c.headlineSuffix}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#a8cfc0]">{c.sub}</p>

          <div className="mt-4 border-l-2 border-[#2f8f6d]/40 pl-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8dd2b1]">
              {c.whyTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#cce5da]">{c.whyBody}</p>
          </div>

          <ul className="mt-4 space-y-1.5 text-xs text-[#cce5da]">
            {c.bullets.map((b) => (
              <li key={b.strong} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">
                  &#10003;
                </span>
                <span>
                  <span className="font-semibold text-white">{b.strong}</span>
                  {b.rest}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#2f8f6d]/25 pt-3 text-[10px]">
            {c.compare.map((col) => (
              <div key={col.label}>
                <div
                  className={`font-bold uppercase tracking-[0.12em] ${
                    col.emphasis ? "text-[#bdf2cf]" : "text-[#7aab98]"
                  }`}
                >
                  {col.label}
                </div>
                <div
                  className={`mt-0.5 ${
                    col.emphasis ? "font-semibold text-white" : "text-[#a8cfc0]"
                  }`}
                >
                  {col.body}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs text-[#7aab98]">
            Already have an account?{" "}
            <Link href={signInHref} className="font-bold text-[#bdf2cf] hover:text-white">
              Login &rarr;
            </Link>
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SignUp path="/sign-up" signInUrl={signInHref} fallbackRedirectUrl={redirectAfter} forceRedirectUrl={redirectAfter} />
        </div>
      </div>
    </main>
  );
}
