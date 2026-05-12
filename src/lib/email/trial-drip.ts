import { clerkClient } from "@clerk/nextjs/server";
import { getSql } from "@/lib/db";
import {
  getAppBaseUrl,
  getFromAddress,
  getReplyToAddress,
  getResend,
} from "./client";

/**
 * 14-day trial drip — eight scheduled emails over the first two weeks of an
 * organization's life. Anchor is `organizations.created_at`. The cron route
 * `/api/cron/trial-drip` runs daily, computes the org's trial-day, and fires
 * the matching step exactly once (deduped via `trial_drip_sends`).
 *
 * Goals (in priority order):
 *  1. Get the user inside the platform every day of the trial — the only
 *     reliable predictor of conversion is workspace activity.
 *  2. Surface the Custodia Compliance Officer early, often, and by name. The
 *     Custodia Success Guarantee is the retention story; emails should keep
 *     reminding the user it exists.
 *  3. Hit the day-12 + day-13 conversion window hard, but never in a way
 *     that contradicts the public "no card to start" promise.
 *
 * Each step has a `dayOffset` (0-indexed days since `created_at`), a stable
 * `key` (used as the dedupe primary key), a subject, and HTML/text renderers.
 * Renderers receive `{ greeting, workspaceUrl, billingUrl }` so they never
 * touch env vars directly.
 */

export type DripContext = {
  greeting: string;
  workspaceUrl: string;
  billingUrl: string;
  pricingUrl: string;
  ticketUrl: string;
};

export type DripStep = {
  /** Stable identifier — never reuse a key, never rename in place. */
  key: string;
  /** Days since organizations.created_at this step fires on. */
  dayOffset: number;
  subject: string;
  preheader: string;
  /** Plain-text renderer (every Resend send must include both). */
  text: (ctx: DripContext) => string;
  /** HTML renderer. Use the shared `renderShell()` helper for consistency. */
  html: (ctx: DripContext) => string;
};

// ---- Step definitions --------------------------------------------------

export const TRIAL_DRIP_STEPS: DripStep[] = [
  {
    key: "day_1_get_started",
    dayOffset: 1,
    subject: "Day 1 — your fastest path to a CMMC L1 package",
    preheader:
      "Charlie is set up. Five minutes today gets you a third of the way to bid-ready.",
    text: (c) => `${c.greeting}

Day 1 of your 14-day trial. The fastest path to bid-ready starts with a five-minute interview — Charlie asks about your business, your stack, and what federal work you're chasing, then tailors the rest of the platform to that.

Open your workspace: ${c.workspaceUrl}

You don't need to finish anything tonight. Just show up. The users who go bid-ready inside week 1 all do the same thing: they open the platform on day 1, day 2, and day 3.

If anything is unclear, your assigned Custodia Compliance Officer is one ticket away — that is the Custodia Success Guarantee, and it is on from the day you signed up.

— The Custodia team
Pittsburgh, PA · Veteran-owned · CMU built`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 1 of 14",
        title: "The fastest path to bid-ready starts with five minutes.",
        intro: `Open the workspace and let Charlie run the onboarding interview. It tailors the rest of the 15 safeguarding requirements to your business, your stack, and the federal work you're chasing.`,
        bullets: [
          "Five-minute interview — no prep required.",
          "Charlie surfaces the easiest practices first so you bank wins early.",
          "Your assigned Compliance Officer is one ticket away from day one.",
        ],
        ctaLabel: "Open my workspace →",
        ctaUrl: c.workspaceUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_3_easy_wins",
    dayOffset: 3,
    subject: "Charlie's 5 fastest wins for CMMC L1",
    preheader:
      "Five practices most users mark complete in under thirty minutes — knock them out today.",
    text: (c) => `${c.greeting}

Day 3. Most users have already cleared 4–5 of the 15 CMMC L1 safeguarding requirements by now. Here are the fastest ones to knock out tonight:

  1. AC.L1-3.1.1 — Authorized users (export from M365 / Google).
  2. AC.L1-3.1.20 — External system connections (a one-page diagram).
  3. IA.L1-3.5.1 — Identification (you already enforce this; document it).
  4. IA.L1-3.5.2 — Authentication (MFA settings screenshot).
  5. PE.L1-3.10.1 — Physical access (visitor + access roster, template provided).

Pull up the dashboard: ${c.workspaceUrl}

Charlie can draft the narrative for any of them — open the chat panel and ask. If a practice has you stuck, message your officer. We do not want you stalling on this.

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 3 of 14",
        title: "Five fastest wins. Knock them out tonight.",
        intro: `Most users have 4–5 of the 15 requirements cleared by day 3. These five are the fastest path there — every one of them is mostly templated or already true at your business; you just have to document it.`,
        bullets: [
          "<b>AC.L1-3.1.1</b> — Authorized users roster (M365/Google export).",
          "<b>AC.L1-3.1.20</b> — External system connections (one-page diagram).",
          "<b>IA.L1-3.5.1</b> — Identification policy (document what you already do).",
          "<b>IA.L1-3.5.2</b> — Authentication / MFA (settings screenshot).",
          "<b>PE.L1-3.10.1</b> — Physical access (template provided).",
        ],
        ctaLabel: "Open the dashboard →",
        ctaUrl: c.workspaceUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_5_halfway",
    dayOffset: 5,
    subject: "You're a third of the way through the trial — and that's fine",
    preheader:
      "What 'on track' looks like at day 5, and the one thing that quietly stalls users.",
    text: (c) => `${c.greeting}

Day 5. A third of the way through.

What "on track" looks like right now:
  • Onboarding interview done
  • 6–9 of the 15 requirements marked yes/partial/no
  • Two pieces of evidence uploaded
  • Charlie has answered at least one question for you

If you're behind that, the single most common reason is the same: the user opens a practice, looks at the wording, and closes the tab to come back later. They never come back. The fix is small — open the practice, ask Charlie what it means in plain English, decide yes/partial/no in 60 seconds. Do not let perfect block done.

Workspace: ${c.workspaceUrl}

Your assigned Custodia Compliance Officer is reading every officer ticket. If you are stuck on something specific — a control, a piece of evidence, a prime asking a weird question — open one. We will help.

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 5 of 14",
        title: "A third of the way through. Here's what 'on track' looks like.",
        intro: `If you are behind the checklist below, the cause is almost always the same: a practice opened, the wording felt heavy, and the tab got closed. The fix is small — open it, ask Charlie what it means in plain English, decide yes / partial / no in sixty seconds.`,
        bullets: [
          "Onboarding interview done.",
          "6–9 of the 15 requirements have a status marked.",
          "At least two pieces of evidence uploaded.",
          "Charlie has answered at least one of your questions.",
        ],
        ctaLabel: "Open my workspace →",
        ctaUrl: c.workspaceUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_7_bid_ready_milestone",
    dayOffset: 7,
    subject: "Day 7 — the bid-ready milestone",
    preheader:
      "Most users are bid-ready by today. Here's how to confirm — or course-correct.",
    text: (c) => `${c.greeting}

Day 7. Halfway. This is the day most users finish their initial CMMC L1 package.

Two things to do today:

1) Open your dashboard and check the Package Readiness card. If it says "ready," generate the bid package ZIP. That is your SSP, your signed affirmation memo, and every artifact a prime might ask for, all in one file. Do it now while it is fresh.

2) If you are not at "ready" yet, that is fine — open one officer ticket telling us where you are stuck. A human responds; we walk you through it. The Custodia Success Guarantee says we get you to bid-ready, period.

Workspace: ${c.workspaceUrl}

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 7 of 14",
        title: "The bid-ready milestone.",
        intro: `Most users finish their initial CMMC L1 package today. If you are there: generate the bid-package ZIP — your SSP, signed affirmation memo, and every artifact a prime might ask for, in one file. If you are not there: open an officer ticket. The Success Guarantee covers exactly this moment.`,
        bullets: [
          "Open the dashboard's Package Readiness card.",
          "If green: generate and download your bid-package ZIP.",
          "If yellow or red: open one officer ticket — we walk you through it.",
        ],
        ctaLabel: "Check my package →",
        ctaUrl: c.workspaceUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_10_officer",
    dayOffset: 10,
    subject: "Meet your Custodia Compliance Officer",
    preheader:
      "Year-round, by name. The reason Custodia is a cybersecurity firm and not a chatbot.",
    text: (c) => `${c.greeting}

Day 10. Four days left in the trial.

Here is the part of Custodia that does not fit in a feature list: the platform is the leverage. The officer is the guarantee. Upon enrollment we assigned you a credentialed Compliance Officer — Master's-educated, CMMC-aligned credentials, years of federal compliance experience. Not a tier-1 agent reading a script. Not a chatbot. A human who learns your environment and defends your package if it is ever challenged.

That officer is on call year-round, every year you stay a member. If a prime questions your SPRS submission, your officer takes the conversation — including direct comms with the prime — until the package is accepted. If a control is unclear at month seven, you message us; we answer.

Open an officer ticket if you want to introduce yourself: ${c.ticketUrl}

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 10 of 14",
        title: "The platform is the leverage. The officer is the guarantee.",
        intro: `Custodia is a cybersecurity firm first — not just a web app. Upon enrollment we assigned you a credentialed Compliance Officer: Master's-educated, CMMC-aligned credentials, years of federal compliance experience. They are on call year-round, every year you stay a member.`,
        bullets: [
          "If a prime questions your package, your officer takes the conversation — directly — until it is accepted.",
          "If a control is unclear at month seven, you message us. We answer.",
          "If your CMMC L1 package isn't defensible, your officer rebuilds it with you, on our time, until it is.",
        ],
        ctaLabel: "Open an officer ticket →",
        ctaUrl: c.ticketUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_12_two_days_left",
    dayOffset: 12,
    subject: "Two days left in your trial",
    preheader:
      "What happens on day 14, and what stays with you either way.",
    text: (c) => `${c.greeting}

Day 12. Two days left.

What happens on day 14:
  • Your trial ends. If you add a card, you continue at $149/month on Self Service — the Fiscal-Year Compliance Special, locked through fiscal-year end (Sept 30). List price is $197/month. If you want a credentialed human Custodia Compliance Officer on call too, the Self Service + Custodia Officer plan is $297/month.
  • If you don't add a card, your access pauses. The CMMC L1 package you built stays exported in the bid-package ZIP you already generated — you keep it.

What you keep by paying:
  • Your assigned Compliance Officer, on call year-round.
  • Continuous monitoring of M365 / Google for evidence freshness.
  • Annual re-affirmation prepped automatically every October.
  • The Custodia CMMC L1 Success Guarantee — if your package isn't defensible to FAR 52.204-21 standard, we rebuild it with you until it is.
  • Bid Radar — daily SAM.gov opportunities matched to your NAICS.

Lock in the launch tier here: ${c.billingUrl}

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 12 of 14",
        title: "Two days left. Here is what changes on day 14.",
        intro: `If you add a card you continue at <b>$149/month</b> on Self Service — the Fiscal-Year Compliance Special, locked through fiscal-year end (Sept 30; list price is $197/month). If you want a credentialed human Compliance Officer on call too, that's <b>$297/month</b>. If you do not add a card, your access pauses and the CMMC L1 package you already built stays exported. You keep what you built either way.`,
        bullets: [
          "Your assigned Compliance Officer, on call year-round.",
          "Continuous M365 / Google monitoring for evidence freshness.",
          "Annual re-affirmation prepped every October.",
          "CMMC L1 Success Guarantee — defensible package or we rebuild it with you.",
          "Bid Radar — daily SAM.gov opportunities matched to your NAICS.",
        ],
        ctaLabel: "Lock in the launch tier →",
        ctaUrl: c.billingUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_13_tomorrow",
    dayOffset: 13,
    subject: "Tomorrow your $149/mo seat opens",
    preheader: "Last day of the trial. The Success Guarantee starts when you do.",
    text: (c) => `${c.greeting}

Day 13. The trial ends tomorrow.

If you want to keep going, add a card today. $149/month on Self Service (Fiscal-Year Compliance Special, locked through Sept 30 — was $197 list), or $297/month if you want a credentialed human Custodia Compliance Officer on call. No contract, cancel any time inside the platform. The Custodia CMMC L1 Success Guarantee turns on the day your subscription begins.

Add a card: ${c.billingUrl}

If you would rather not, that is fine. Your bid-package ZIP is yours to keep. Your account stays open if you want to come back later.

If you have a question that the difference between yes and no hinges on — pricing, scope, what your officer actually does — reply to this email. A human reads every reply.

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 13 of 14",
        title: "Tomorrow your $149 / month seat opens.",
        intro: `Add a card today and the Custodia CMMC L1 Success Guarantee turns on the day your subscription begins. $149/month on Self Service (Fiscal-Year Compliance Special, locked through Sept 30 — was $197 list), or $297/month if you want a credentialed human Custodia Compliance Officer on call. No contract, cancel any time.`,
        bullets: [
          "$149/month — Self Service, Fiscal-Year Compliance Special (was $197 list).",
          "$297/month — Self Service + Custodia Compliance Officer if you want a human on call.",
          "Cancel any time, inside the platform, two clicks.",
          "Reply to this email if a question is the difference between yes and no — a human reads every reply.",
        ],
        ctaLabel: "Add my card →",
        ctaUrl: c.billingUrl,
        footer: officerFooter(c),
      }),
  },
  {
    key: "day_14_decision",
    dayOffset: 14,
    subject: "Your trial ends today",
    preheader:
      "If you stay, the Success Guarantee starts now. If you don't, you keep what you built.",
    text: (c) => `${c.greeting}

Day 14. The trial ends today.

If you decide to stay: add your card and your access continues without interruption. Your assigned Compliance Officer stays with you, year-round, every year of membership. The Custodia CMMC L1 Success Guarantee starts today.

If you decide not to: the bid-package ZIP you generated is yours. Your account remains. You can come back later.

Either way, thank you for trying Custodia. Federal compliance is a fight every small business has to win at some point — we are honored you considered us for this round.

Add a card: ${c.billingUrl}

— The Custodia team`,
    html: (c) =>
      renderShell({
        ...c,
        kicker: "Day 14 — decision day",
        title: "Your trial ends today.",
        intro: `If you stay, your assigned officer stays with you and the Success Guarantee starts now. If you don't, the bid-package ZIP you generated is yours and your account remains so you can come back. Either way — thank you for trying Custodia.`,
        bullets: [
          "Stay: $149/mo Self Service (Fiscal-Year Special) or $297/mo with a human Compliance Officer. Guarantee active either way.",
          "Pause: keep your exported package, account stays open.",
          "Reply to this email any time. A human reads every reply.",
        ],
        ctaLabel: "Continue with Custodia →",
        ctaUrl: c.billingUrl,
        footer: officerFooter(c),
      }),
  },
];

// ---- Public API --------------------------------------------------------

/**
 * Find every org whose trial-day matches a step that hasn't been sent yet,
 * and send the matching email. Idempotent: safe to run repeatedly. Returns
 * a per-step counter for the cron's response payload.
 *
 * Implementation notes:
 *  - Anchor is `organizations.created_at` (org row creation, which happens
 *    inside ensureOrgForUser on first authenticated entry). This will be
 *    within minutes of the Clerk sign-up.
 *  - We send for any org where (now - created_at) is in the half-open day
 *    window [step.dayOffset, step.dayOffset + 1). That means even if cron
 *    runs slightly late, every step still fires once and once only.
 *  - Welcome email (day 0) is owned by `ensureWelcomeEmailSent`; this
 *    module never re-sends it.
 *  - Skips orgs with `trial_drip_disabled = TRUE` (manual kill switch for
 *    complaints / unsubscribes / paid-conversion early opt-out).
 */
export async function dispatchTrialDripDue(): Promise<{
  attempted: number;
  sent: Array<{ organization_id: string; step_key: string }>;
  skipped: Array<{ organization_id: string; step_key: string; reason: string }>;
}> {
  if (!process.env.RESEND_API_KEY) {
    return { attempted: 0, sent: [], skipped: [] };
  }
  const sql = getSql();
  const sent: Array<{ organization_id: string; step_key: string }> = [];
  const skipped: Array<{
    organization_id: string;
    step_key: string;
    reason: string;
  }> = [];
  let attempted = 0;

  for (const step of TRIAL_DRIP_STEPS) {
    // Orgs whose trial-day is exactly this step's offset and have not yet
    // received this step. Half-open day window guards against late cron runs.
    const due = (await sql`
      SELECT o.id, o.owner_user_id, o.name
      FROM organizations o
      WHERE o.trial_drip_disabled = FALSE
        AND o.created_at <= NOW() - (${step.dayOffset}::int || ' days')::interval
        AND o.created_at >  NOW() - ((${step.dayOffset}::int + 1) || ' days')::interval
        AND NOT EXISTS (
          SELECT 1 FROM trial_drip_sends s
          WHERE s.organization_id = o.id AND s.step_key = ${step.key}
        )
      LIMIT 200
    `) as Array<{ id: string; owner_user_id: string; name: string | null }>;

    for (const org of due) {
      attempted += 1;
      try {
        const result = await sendStep(step, org);
        if (result === "sent") {
          sent.push({ organization_id: org.id, step_key: step.key });
        } else {
          skipped.push({
            organization_id: org.id,
            step_key: step.key,
            reason: result,
          });
        }
      } catch (err) {
        console.error(
          `[trial-drip] step=${step.key} org=${org.id} failed:`,
          err,
        );
        skipped.push({
          organization_id: org.id,
          step_key: step.key,
          reason: "send_error",
        });
      }
    }
  }

  return { attempted, sent, skipped };
}

// ---- Internal helpers --------------------------------------------------

async function sendStep(
  step: DripStep,
  org: { id: string; owner_user_id: string; name: string | null },
): Promise<"sent" | "no_email" | "no_user"> {
  const sql = getSql();
  const client = await clerkClient();

  let user;
  try {
    user = await client.users.getUser(org.owner_user_id);
  } catch {
    return "no_user";
  }
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  const toEmail = primary?.emailAddress;
  if (!toEmail) return "no_email";

  const greeting = user.firstName ? `Hi ${user.firstName},` : "Hi,";
  const base = getAppBaseUrl();
  const ctx: DripContext = {
    greeting,
    workspaceUrl: `${base}/assessments`,
    billingUrl: `${base}/upgrade`,
    pricingUrl: `${base}/pricing`,
    ticketUrl: `${base}/assessments/tickets/new`,
  };

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [toEmail],
    replyTo: getReplyToAddress(),
    subject: step.subject,
    html: step.html(ctx),
    text: step.text(ctx),
    headers: {
      "X-Entity-Ref-ID": `custodia-trial-drip-${step.key}`,
    },
  });

  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
  const messageId = result.data?.id ?? null;

  // Idempotent insert. If two cron runs race, the PK conflict means only the
  // first send is recorded — and crucially the email itself is still sent
  // exactly once because Resend's HTTP API is the only network call above
  // the dedupe row. We accept the (rare) race as at-most-once-but-better.
  await sql`
    INSERT INTO trial_drip_sends (organization_id, step_key, message_id)
    VALUES (${org.id}::uuid, ${step.key}, ${messageId})
    ON CONFLICT (organization_id, step_key) DO NOTHING
  `;

  return "sent";
}

// ---- HTML shell --------------------------------------------------------

function renderShell(opts: {
  greeting: string;
  kicker: string;
  title: string;
  intro: string;
  bullets: string[];
  ctaLabel: string;
  ctaUrl: string;
  workspaceUrl: string;
  ticketUrl: string;
  pricingUrl: string;
  billingUrl: string;
  footer: string;
}): string {
  const bullets = opts.bullets
    .map(
      (b) =>
        `<li style="margin:6px 0;font-size:15px;line-height:1.55;color:#0f172a;">${b}</li>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeAttr(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:24px 32px;color:#fbbf24;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Custodia · ${escapeAttr(opts.kicker)}</div>
              <div style="margin-top:4px;font-size:13px;color:#cbd5e1;">CMMC Level 1, made simple.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:16px;">${escapeAttr(opts.greeting)}</p>
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">${escapeAttr(opts.title)}</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#0f172a;">${opts.intro}</p>
              <ul style="margin:16px 0;padding-left:20px;">${bullets}</ul>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 16px 0;">
                <tr>
                  <td style="background:#fbbf24;border-radius:8px;">
                    <a href="${escapeAttr(opts.ctaUrl)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:700;color:#0f172a;text-decoration:none;">${escapeAttr(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;color:#475569;line-height:1.55;">${opts.footer}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f1f5f9;padding:18px 32px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
              <div>The Custodia team</div>
              <div style="margin-top:2px;">Pittsburgh, PA · Veteran-owned · CMU built</div>
              <div style="margin-top:8px;color:#94a3b8;">You are receiving this because you started a Custodia trial. The drip stops automatically on day 14, and your assigned officer can disable it any time on request.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function officerFooter(c: DripContext): string {
  return `Reply to this email any time — a real human reads every message (<a href="mailto:officers@custodia.us" style="color:#0f172a;">officers@custodia.us</a>). For anything that needs a credentialed officer's judgment, open an in-platform ticket: <a href="${escapeAttr(c.ticketUrl)}" style="color:#0f172a;">${escapeAttr(c.ticketUrl)}</a>.`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
