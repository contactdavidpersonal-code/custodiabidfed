import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAssessmentForUser } from "@/lib/assessment";
import { loadBidProfile, setAsideLabels } from "@/lib/bid-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bid-Ready Packet (single HTML doc, printable to PDF).
 *
 * Snapshots the editable Master Bid Profile (capability statement, past
 * performance, insurance, set-asides, POC) AND the locked compliance posture
 * (legal name, UEI, CAGE, NAICS, scope, CMMC L1 affirmation status) into one
 * print-ready document. Different from /api/assessments/[id]/bid-package —
 * that route bundles the full SSP + every evidence file as a ZIP for prime
 * questionnaires. THIS route is the marketing-front-door packet a small
 * business sends to a contracting officer or attaches to a SAM.gov bid.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await context.params;
  const ctx = await getAssessmentForUser(id, userId);
  if (!ctx) {
    return new NextResponse("Not found", { status: 404 });
  }

  const profile = await loadBidProfile(ctx.organization.id);
  const html = renderPacket({
    org: ctx.organization,
    assessment: ctx.assessment,
    profile,
    generatedAt: new Date().toISOString(),
  });

  const orgSlug = ctx.organization.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const filename = `${orgSlug}-bid-ready-packet.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

type RenderInput = {
  org: {
    name: string;
    entity_type: string | null;
    sam_uei: string | null;
    cage_code: string | null;
    naics_codes: string[];
    scoped_systems: string | null;
  };
  assessment: {
    cycle_label: string;
    fiscal_year: number;
    status: string;
    affirmed_at: string | null;
    affirmed_by_name: string | null;
    affirmed_by_title: string | null;
    implements_all_17: boolean | null;
  };
  profile: Awaited<ReturnType<typeof loadBidProfile>>;
  generatedAt: string;
};

function renderPacket(input: RenderInput): string {
  const { org, assessment, profile, generatedAt } = input;

  const attested = assessment.status === "attested";
  const affirmDate = assessment.affirmed_at
    ? new Date(assessment.affirmed_at).toLocaleDateString()
    : null;

  const setAsideBadges =
    profile.set_asides.length === 0
      ? `<span class="muted">None claimed</span>`
      : profile.set_asides
          .map(
            (s) =>
              `<span class="badge">${esc(setAsideLabels[s] ?? s)}</span>`,
          )
          .join(" ");

  const competenciesList = profile.core_competencies
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const competenciesHtml =
    competenciesList.length === 0
      ? `<p class="muted">No core competencies on file.</p>`
      : `<ul class="bullets">${competenciesList
          .map((c) => `<li>${esc(c)}</li>`)
          .join("")}</ul>`;

  const ppRows =
    profile.past_performance.length === 0
      ? `<tr><td colspan="5" class="muted center">No past-performance entries on file yet.</td></tr>`
      : profile.past_performance
          .map(
            (p) => `
              <tr>
                <td>
                  <div class="strong">${esc(p.agency || "—")}</div>
                  <div class="small muted">${esc(p.contract_no || "—")}</div>
                </td>
                <td class="mono small">${esc(p.naics || "—")}</td>
                <td class="small">${esc(p.period_start || "—")} → ${esc(p.period_end || "—")}</td>
                <td class="strong small">${esc(p.value_usd || "—")}</td>
                <td class="small">${esc(p.scope || "—")}</td>
              </tr>`,
          )
          .join("");

  const naicsLine =
    org.naics_codes.length > 0 ? org.naics_codes.join(", ") : "—";

  const affirmationBlock = attested
    ? `<div class="callout success">
        <div class="callout-title">CMMC Level 1 — Self-Affirmed</div>
        <p>${esc(org.name)} has self-affirmed implementation of all 17 security requirements at FAR 52.204-21(b)(1) for fiscal year ${assessment.fiscal_year}.</p>
        <dl class="kv">
          <div><dt>Affirming official</dt><dd>${esc(assessment.affirmed_by_name ?? "—")}${assessment.affirmed_by_title ? `, ${esc(assessment.affirmed_by_title)}` : ""}</dd></div>
          <div><dt>Date of affirmation</dt><dd>${esc(affirmDate ?? "—")}</dd></div>
          <div><dt>Cycle</dt><dd>${esc(assessment.cycle_label)}</dd></div>
          <div><dt>Status</dt><dd>${assessment.implements_all_17 ? "Implements all 17" : "Pending review"}</dd></div>
        </dl>
        <p class="small muted">Filed in the DoD Supplier Performance Risk System (SPRS) per 32 CFR § 170.22. Full System Security Plan and per-practice evidence available on request.</p>
      </div>`
    : `<div class="callout warn">
        <div class="callout-title">CMMC Level 1 — Affirmation pending</div>
        <p>${esc(org.name)} has not yet completed its annual CMMC Level 1 self-affirmation for fiscal year ${assessment.fiscal_year}. This packet is a draft preview.</p>
      </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(org.name)} — Bid-Ready Packet</title>
<style>${PACKET_CSS}</style>
</head>
<body>
<div class="page-actions no-print">
  <button onclick="window.print()" class="btn-primary">Print / Save as PDF</button>
</div>

<article>
  <header class="cover">
    <div class="eyebrow">Capability Packet</div>
    <h1>${esc(org.name)}</h1>
    ${profile.website ? `<p class="website"><a href="${esc(profile.website)}">${esc(profile.website)}</a></p>` : ""}
    <div class="cover-meta">
      <div class="cover-meta-col">
        <div class="label">Entity type</div>
        <div>${esc(org.entity_type ?? "—")}</div>
      </div>
      <div class="cover-meta-col">
        <div class="label">SAM UEI</div>
        <div class="mono">${esc(org.sam_uei ?? "—")}</div>
      </div>
      <div class="cover-meta-col">
        <div class="label">CAGE code</div>
        <div class="mono">${esc(org.cage_code ?? "—")}</div>
      </div>
      <div class="cover-meta-col">
        <div class="label">NAICS</div>
        <div class="mono small">${esc(naicsLine)}</div>
      </div>
    </div>
    <div class="badges">${setAsideBadges}</div>
  </header>

  <section class="grid-2">
    <div>
      <h2>Capability statement</h2>
      <div class="prose">${formatProse(profile.capability_statement)}</div>
    </div>
    <aside>
      <h2>Point of contact</h2>
      <dl class="kv stacked">
        <div><dt>Name</dt><dd class="strong">${esc(profile.poc_name || "—")}</dd></div>
        <div><dt>Title</dt><dd>${esc(profile.poc_title || "—")}</dd></div>
        <div><dt>Email</dt><dd>${profile.poc_email ? `<a href="mailto:${esc(profile.poc_email)}">${esc(profile.poc_email)}</a>` : "—"}</dd></div>
        <div><dt>Phone</dt><dd>${esc(profile.poc_phone || "—")}</dd></div>
      </dl>
    </aside>
  </section>

  <section>
    <h2>Core competencies</h2>
    ${competenciesHtml}
  </section>

  ${
    profile.differentiators.trim()
      ? `<section>
           <h2>Differentiators</h2>
           <div class="prose">${formatProse(profile.differentiators)}</div>
         </section>`
      : ""
  }

  <section>
    <h2>Compliance posture</h2>
    ${affirmationBlock}
    ${
      org.scoped_systems
        ? `<div class="scope">
             <div class="label">Assessment scope</div>
             <p>${esc(org.scoped_systems)}</p>
           </div>`
        : ""
    }
  </section>

  <section>
    <h2>Past performance</h2>
    <table class="pp">
      <thead>
        <tr>
          <th>Agency / Contract</th>
          <th>NAICS</th>
          <th>Period</th>
          <th>Value</th>
          <th>Scope</th>
        </tr>
      </thead>
      <tbody>${ppRows}</tbody>
    </table>
  </section>

  <section class="grid-2">
    <div>
      <h2>Insurance</h2>
      <dl class="kv stacked">
        <div><dt>Carrier</dt><dd>${esc(profile.insurance.carrier || "—")}</dd></div>
        <div><dt>Policy #</dt><dd class="mono small">${esc(profile.insurance.policy_number || "—")}</dd></div>
        <div><dt>General liability</dt><dd>${esc(profile.insurance.general_liability_limit || "—")}</dd></div>
        <div><dt>Professional liability</dt><dd>${esc(profile.insurance.professional_liability_limit || "—")}</dd></div>
        <div><dt>Expires</dt><dd>${esc(profile.insurance.expiration_date || "—")}</dd></div>
      </dl>
    </div>
    <div>
      <h2>Bonding</h2>
      <dl class="kv stacked">
        <div><dt>Bonding company</dt><dd>${esc(profile.bonding.bonding_company || "Not bonded")}</dd></div>
        <div><dt>Capacity</dt><dd>${esc(profile.bonding.bonding_capacity_usd || "—")}</dd></div>
      </dl>
    </div>
  </section>

  <footer class="doc-foot">
    <div>
      <div class="strong">${esc(org.name)}</div>
      <div class="small muted">UEI ${esc(org.sam_uei ?? "—")} · CAGE ${esc(org.cage_code ?? "—")}</div>
    </div>
    <div class="small muted">Generated by Custodia · ${new Date(generatedAt).toLocaleDateString()} ${new Date(generatedAt).toLocaleTimeString()}</div>
  </footer>
</article>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatProse(text: string): string {
  if (!text.trim()) return `<p class="muted">Not yet provided.</p>`;
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para.trim()).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

const PACKET_CSS = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #10231d; background: #f7f7f3; margin: 0; padding: 32px 16px; line-height: 1.55; }
  article { max-width: 820px; margin: 0 auto; background: white; border: 1px solid #cfe3d9; padding: 56px 48px; }
  h1 { font-family: "Source Serif Pro", Georgia, serif; font-size: 36px; margin: 8px 0 0; letter-spacing: -0.01em; }
  h2 { font-family: "Source Serif Pro", Georgia, serif; font-size: 18px; margin: 32px 0 12px; letter-spacing: -0.005em; color: #0e2a23; border-bottom: 1px solid #cfe3d9; padding-bottom: 6px; }
  p { margin: 8px 0; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.22em; font-size: 11px; font-weight: 700; color: #2f8f6d; }
  .website a { color: #2f8f6d; text-decoration: none; font-size: 13px; }
  .cover { border-bottom: 2px solid #10231d; padding-bottom: 28px; margin-bottom: 28px; }
  .cover-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 22px; }
  .cover-meta-col .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #456c5f; margin-bottom: 4px; }
  .badges { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 6px; }
  .badge { display: inline-block; background: #f1f9f4; color: #0e2a23; border: 1px solid #2f8f6d; padding: 3px 10px; font-size: 11px; font-weight: 600; }
  .grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 32px; }
  aside h2 { margin-top: 32px; }
  .prose p { font-size: 13.5px; line-height: 1.65; color: #10231d; }
  .bullets { margin: 8px 0; padding-left: 20px; }
  .bullets li { font-size: 13px; padding: 2px 0; }
  .kv { margin: 8px 0; }
  .kv > div { display: flex; gap: 12px; padding: 4px 0; font-size: 12.5px; border-bottom: 1px dashed #e3eee8; }
  .kv > div:last-child { border-bottom: 0; }
  .kv dt { color: #456c5f; min-width: 130px; font-weight: 600; }
  .kv dd { margin: 0; color: #10231d; flex: 1; }
  .kv.stacked > div { display: block; padding: 6px 0; }
  .kv.stacked dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #456c5f; min-width: 0; margin-bottom: 2px; }
  .kv.stacked dd { font-size: 13px; }
  .callout { padding: 16px 18px; border-left: 4px solid; margin: 8px 0 16px; }
  .callout-title { font-weight: 700; margin-bottom: 6px; font-size: 13px; }
  .callout.success { background: #f1f9f4; border-color: #2f8f6d; }
  .callout.warn { background: #fff7e8; border-color: #a06b1a; }
  .scope { margin-top: 12px; padding: 14px 16px; background: #f7fcf9; border: 1px solid #cfe3d9; }
  .scope .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #456c5f; margin-bottom: 4px; }
  .scope p { font-size: 12.5px; }
  table.pp { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.pp th { text-align: left; background: #f7fcf9; border-bottom: 1px solid #cfe3d9; padding: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #456c5f; }
  table.pp td { padding: 10px 8px; border-bottom: 1px solid #e3eee8; vertical-align: top; }
  .doc-foot { margin-top: 40px; padding-top: 16px; border-top: 1px solid #cfe3d9; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .small { font-size: 11px; }
  .strong { font-weight: 700; }
  .muted { color: #6b8a80; }
  .center { text-align: center; }
  .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
  .page-actions { max-width: 820px; margin: 0 auto 16px; display: flex; justify-content: flex-end; }
  .btn-primary { background: #10231d; color: white; border: 0; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-primary:hover { background: #0e2a23; }
  @media print {
    body { background: white; padding: 0; }
    article { border: 0; padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
`;
