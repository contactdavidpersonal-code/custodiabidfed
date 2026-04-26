import { auth } from "@clerk/nextjs/server";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import {
  getAssessmentForUser,
  listEvidenceForAssessment,
  listRemediationPlansForAssessment,
  listResponsesForAssessment,
  type AssessmentRow,
  type ControlResponseRow,
  type EvidenceArtifactRow,
  type OrganizationRow,
  type RemediationPlanRow,
} from "@/lib/assessment";
import { controlDomains, playbook } from "@/lib/playbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bid-ready package export. Bundles everything a user needs to hand a prime
 * (or file alongside their SPRS affirmation): README with submission steps,
 * SSP + affirmation memo as standalone HTML, control + evidence CSV
 * inventories, and every evidence artifact fetched from Vercel Blob organized
 * by control. Gated on attested status — an unsigned package is not a
 * "bid-ready" package.
 */
export async function GET(
  req: Request,
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

  const forceDraft =
    new URL(req.url).searchParams.get("draft") === "1";
  if (ctx.assessment.status !== "attested" && !forceDraft) {
    return new NextResponse(
      "Assessment not attested. Add ?draft=1 to download an unsigned preview.",
      { status: 409 },
    );
  }

  const [responses, evidence, remediationPlans] = await Promise.all([
    listResponsesForAssessment(id),
    listEvidenceForAssessment(id),
    listRemediationPlansForAssessment(id),
  ]);

  const zip = new JSZip();
  const org = ctx.organization;
  const a = ctx.assessment;
  const generatedAt = new Date().toISOString();

  zip.file(
    "00-README.md",
    buildReadme({ org, assessment: a, generatedAt, draft: forceDraft }),
  );
  zip.file(
    "01-SSP.html",
    buildSspHtml({ org, assessment: a, responses, evidence, generatedAt }),
  );
  zip.file(
    "02-Affirmation.html",
    buildAffirmationHtml({ org, assessment: a, generatedAt }),
  );
  zip.file("03-controls.csv", buildControlsCsv(responses, evidence));
  zip.file("04-evidence-inventory.csv", buildEvidenceCsv(evidence));
  zip.file("05-remediation-plans.csv", buildRemediationCsv(remediationPlans));

  for (const artifact of evidence) {
    try {
      const res = await fetch(artifact.blob_url);
      if (!res.ok) {
        console.warn(
          `[bid-package] skip ${artifact.filename}: blob fetch ${res.status}`,
        );
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const safeName = artifact.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
      zip.file(`evidence/${artifact.control_id}/${safeName}`, buf);
    } catch (err) {
      console.warn(
        `[bid-package] fetch failed for ${artifact.filename}:`,
        err,
      );
    }
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const cycleSlug = a.cycle_label.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const orgSlug = org.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const filename = `${orgSlug}-${cycleSlug}-bid-package.zip`;

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}

function buildReadme(input: {
  org: OrganizationRow;
  assessment: AssessmentRow;
  generatedAt: string;
  draft: boolean;
}): string {
  const { org, assessment, generatedAt, draft } = input;
  const signedLine = assessment.affirmed_at
    ? `Affirmed ${new Date(assessment.affirmed_at).toISOString().slice(0, 10)} by ${assessment.affirmed_by_name} (${assessment.affirmed_by_title}).`
    : "NOT YET SIGNED — this is a draft preview. Do not submit.";
  const implementsAll = assessment.implements_all_17 === true;
  const outcomeLine = assessment.affirmed_at
    ? implementsAll
      ? "**Affirmation outcome:** Implements all 17 CMMC Level 1 security requirements (FAR 52.204-21(b)(1)). Eligible to file a positive affirmation in SPRS."
      : "**Affirmation outcome:** Does NOT implement all 17 CMMC Level 1 security requirements. Do not file a positive affirmation until remediation closes the gap."
    : "**Affirmation outcome:** Pending — not yet signed.";

  return `# ${org.name} — CMMC Level 1 Bid-Ready Package

**Cycle:** ${assessment.cycle_label}
**Fiscal year:** FY${assessment.fiscal_year}
**Generated:** ${generatedAt}
${draft ? "**⚠  DRAFT — not signed. Do not submit to SPRS.**\n" : ""}${signedLine}
${outcomeLine}

> CMMC Level 1 affirmation is **binary**: you either implement all 17 practices in FAR 52.204-21(b)(1) or you don't. There is no partial-credit score for L1. The 110-point NIST SP 800-171 scoring methodology applies to **CMMC Level 2 / DFARS 252.204-7012**, not L1.

---

## What's in this package

| File | What it's for |
| --- | --- |
| 01-SSP.html | System Security Plan. Open in a browser, File → Print → Save as PDF when a prime asks for the SSP. |
| 02-Affirmation.html | Senior Official Annual Affirmation memo (per 32 CFR § 170.22). Print + sign + file. |
| 03-controls.csv | Per-practice status + narrative (17 rows). Handy for a prime's compliance questionnaire. |
| 04-evidence-inventory.csv | Every artifact on file with its Platform review verdict + summary. |
| 05-remediation-plans.csv | Open and closed remediation plans (POA&M-style record for prime questionnaires). |
| evidence/ | All the uploaded evidence files, organized by control ID. |

## How to submit your annual affirmation in SPRS

CMMC Level 1 affirmations are filed in the **Supplier Performance Risk System (SPRS)** at https://www.sprs.csd.disa.mil.

1. Log in to SPRS with your PIEE account. Your CAGE code on file: **${org.cage_code ?? "[not yet issued — complete SAM.gov registration first]"}**.
2. Navigate to the **CMMC Assessments** module (NOT the "NIST SP 800-171 Assessments" module — that one is for L2/DFARS-7012).
3. Start a new **CMMC Level 1 (Self) Affirmation** entry.
4. Enter the affirmation date from this package: ${assessment.affirmed_at ? new Date(assessment.affirmed_at).toISOString().slice(0, 10) : "[pending affirmation]"}.
5. Enter the affirming official's name and title: ${assessment.affirmed_by_name ?? "[pending]"} / ${assessment.affirmed_by_title ?? "[pending]"}.
6. Affirm: ${implementsAll ? "**YES** — implements all 17 CMMC Level 1 security requirements at FAR 52.204-21(b)(1)" : "[Do NOT affirm yes until all 17 practices are implemented]"}.
7. Submit. SPRS will generate a posting date that primes can look up.

Your affirmation is valid for **one year** from the posting date (32 CFR § 170.15(c)(2)). Custodia will remind you when FY${assessment.fiscal_year + 1} re-affirmation is due.

## What a prime will typically ask for

- A copy of **01-SSP.html** (printed to PDF).
- A copy of **02-Affirmation.html** (printed, signed, scanned).
- Occasional follow-up on specific evidence — everything is in evidence/ keyed by practice ID (e.g. evidence/AC.L1-3.1.1/).
- Your SAM UEI (**${org.sam_uei ?? "[not provided]"}**) and CAGE (**${org.cage_code ?? "[not provided]"}**).
- A POA&M / remediation roadmap if any practices were ever marked Partial or Not met. See 05-remediation-plans.csv.

## Legal notice

This package documents a **self-attestation** to FAR 52.204-21 as required by 32 CFR § 170.15. The Affirming Official's signature is a material representation of fact. False, fictitious, or fraudulent statements are subject to criminal penalties under 18 U.S.C. § 1001 and civil liability under the False Claims Act (31 U.S.C. §§ 3729–3733).

---

Generated by Custodia. Questions? officers@custodia.us
`;
}

function buildSspHtml(input: {
  org: OrganizationRow;
  assessment: AssessmentRow;
  responses: ControlResponseRow[];
  evidence: EvidenceArtifactRow[];
  generatedAt: string;
}): string {
  const { org, assessment, responses, evidence, generatedAt } = input;
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const evidenceByControl = new Map<string, EvidenceArtifactRow[]>();
  for (const e of evidence) {
    const list = evidenceByControl.get(e.control_id) ?? [];
    list.push(e);
    evidenceByControl.set(e.control_id, list);
  }
  const domainLabels: Record<string, string> = {
    AC: "Access Control",
    IA: "Identification & Authentication",
    MP: "Media Protection",
    PE: "Physical Protection",
    SC: "System & Communications Protection",
    SI: "System & Information Integrity",
  };
  const statusLabel: Record<ControlResponseRow["status"], string> = {
    unanswered: "Not answered",
    yes: "Met",
    partial: "Partially met",
    no: "Not met",
    not_applicable: "Not applicable",
  };

  const domainSections = controlDomains
    .map((domain) => {
      const practices = playbook.filter((p) => p.domain === domain);
      const body = practices
        .map((practice) => {
          const r = responseByControl.get(practice.id);
          const arts = evidenceByControl.get(practice.id) ?? [];
          const evidenceHtml =
            arts.length === 0
              ? ""
              : `<div class="label">Evidence on file</div><ul>${arts
                  .map(
                    (e) =>
                      `<li>${esc(e.filename)} <span class="muted">(${new Date(
                        e.captured_at,
                      ).toLocaleDateString()})</span></li>`,
                  )
                  .join("")}</ul>`;
          return `
            <div class="practice">
              <div class="practice-head">
                <div>
                  <div class="mono muted">${esc(practice.id)} · ${esc(practice.farReference)}</div>
                  <div class="practice-title">${esc(practice.shortName)}</div>
                </div>
                <span class="pill">${esc(statusLabel[r?.status ?? "unanswered"])}</span>
              </div>
              <p class="practice-desc"><em>${esc(practice.title)}</em></p>
              <div class="label">Implementation</div>
              <p class="narrative">${esc(r?.narrative ?? "No narrative provided for this practice.")}</p>
              ${evidenceHtml}
            </div>
          `;
        })
        .join("");
      return `<section><h3>${domain} · ${esc(domainLabels[domain] ?? domain)}</h3>${body}</section>`;
    })
    .join("");

  const affirmedLine = assessment.affirmed_at
    ? `<p><strong>${esc(assessment.affirmed_by_name ?? "")}</strong>${assessment.affirmed_by_title ? `, ${esc(assessment.affirmed_by_title)}` : ""} affirmed on ${new Date(
        assessment.affirmed_at,
      ).toISOString().slice(0, 10)} that the information in this plan is accurate and that ${esc(org.name)} implements all 17 CMMC Level 1 security requirements as described.</p>`
    : `<p><em>This plan has not yet been signed by a senior official.</em></p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(org.name)} — System Security Plan</title>
<style>${BID_PACKAGE_CSS}</style>
</head>
<body>
<article>
  <header class="doc-head">
    <div class="eyebrow">System Security Plan</div>
    <h1>${esc(org.name)}</h1>
    <p class="subtitle">CMMC Level 1 Self-Assessment · FAR 52.204-21</p>
    <dl class="fields">
      ${field("Cycle", assessment.cycle_label)}
      ${field("Status", assessment.status)}
      ${field("SAM UEI", org.sam_uei ?? "—")}
      ${field("CAGE code", org.cage_code ?? "—")}
      ${field("Entity type", org.entity_type ?? "—")}
      ${field("NAICS codes", org.naics_codes.length > 0 ? org.naics_codes.join(", ") : "—")}
      ${field("Generated", new Date(generatedAt).toLocaleDateString())}
      ${field("Affirmed", assessment.affirmed_at ? new Date(assessment.affirmed_at).toLocaleDateString() : "Not yet signed")}
    </dl>
  </header>

  <section>
    <h2>1. System description and scope</h2>
    <p class="scope">${esc(org.scoped_systems ?? "No scope description provided.")}</p>
  </section>

  <section>
    <h2>2. Senior official affirmation</h2>
    ${affirmedLine}
  </section>

  <section>
    <h2>3. Implementation of the 17 practices</h2>
    <p class="muted small">For each requirement, the narrative below describes how ${esc(org.name)} implements the practice, with supporting evidence on file in the <code>evidence/</code> folder.</p>
    ${domainSections}
  </section>

  <footer class="doc-foot">
    Generated by Custodia on ${new Date(generatedAt).toLocaleDateString()}. This System Security Plan is based on the self-assessment conducted by ${esc(org.name)} against the 17 CMMC Level 1 practices defined in FAR 52.204-21(b)(1).
  </footer>
</article>
</body>
</html>`;
}

function buildAffirmationHtml(input: {
  org: OrganizationRow;
  assessment: AssessmentRow;
  generatedAt: string;
}): string {
  const { org, assessment, generatedAt } = input;
  const affirmDate = assessment.affirmed_at
    ? new Date(assessment.affirmed_at).toLocaleDateString()
    : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(org.name)} — Annual Affirmation</title>
<style>${BID_PACKAGE_CSS}</style>
</head>
<body>
<article class="affirmation">
  <header class="doc-head centered">
    <div class="eyebrow">Annual Affirmation of Compliance</div>
    <h1>CMMC Level 1 — Self-Assessment</h1>
    <p class="subtitle">Pursuant to 32 CFR § 170.22 and the terms of FAR 52.204-21</p>
  </header>

  <section class="body">
    <p>I, <strong>${esc(assessment.affirmed_by_name ?? "[Senior Official Name]")}</strong>${assessment.affirmed_by_title ? `, ${esc(assessment.affirmed_by_title)}` : ", [Title]"} of <strong>${esc(org.name)}</strong>${org.entity_type ? ` (${esc(org.entity_type)})` : ""}, a Senior Official with authority to affirm on behalf of the organization, hereby affirm the following:</p>
    <ol>
      <li>${esc(org.name)} has conducted a self-assessment of its compliance with the 17 security requirements set forth at FAR 52.204-21(b)(1) (the "CMMC Level 1" requirements), consistent with the methodology described in 32 CFR § 170.15.</li>
      <li>The scope of this self-assessment covers all information systems that process, store, or transmit Federal Contract Information (FCI), described in the accompanying System Security Plan as:<div class="scope-box">${esc(org.scoped_systems ?? "[Scope pending — complete the business profile.]")}</div></li>
      <li>To the best of my knowledge, ${esc(org.name)} implements each of the 17 CMMC Level 1 security requirements, and the representations made in the associated System Security Plan are accurate and complete as of the date of this affirmation.</li>
      <li>I understand that this affirmation is a material representation of fact upon which the Government relies. A false, fictitious, or fraudulent affirmation may be subject to criminal, civil, or administrative penalties, including those under the False Claims Act (31 U.S.C. §§ 3729–3733) and 18 U.S.C. § 1001.</li>
      <li>${esc(org.name)} will re-affirm compliance at least annually, and will update this affirmation in the DoD Supplier Performance Risk System (SPRS) in accordance with applicable regulations.</li>
    </ol>

    <dl class="fields two-col">
      ${field("SAM UEI", org.sam_uei ?? "[UEI not provided]")}
      ${field("CAGE code", org.cage_code ?? "[CAGE not provided]")}
      ${field("Assessment cycle", assessment.cycle_label)}
      ${field("Date of affirmation", affirmDate ?? "[Not yet signed]")}
    </dl>

    <div class="sign-row">
      <div>
        <div class="sign-line"></div>
        <div class="label">Signature</div>
        <div class="strong">${esc(assessment.affirmed_by_name ?? "[Senior Official Name]")}</div>
        <div class="small muted">${esc(assessment.affirmed_by_title ?? "[Title]")}</div>
      </div>
      <div>
        <div class="sign-line"></div>
        <div class="label">Date</div>
        <div class="strong">${esc(affirmDate ?? "[_________________]")}</div>
      </div>
    </div>
  </section>

  <footer class="doc-foot">
    Generated by Custodia on ${new Date(generatedAt).toLocaleDateString()}. File this affirmation in SPRS (Supplier Performance Risk System) at sprs.csd.disa.mil alongside your System Security Plan.
  </footer>
</article>
</body>
</html>`;
}

function buildControlsCsv(
  responses: ControlResponseRow[],
  evidence: EvidenceArtifactRow[],
): string {
  const evidenceCount = new Map<string, number>();
  for (const e of evidence) {
    evidenceCount.set(e.control_id, (evidenceCount.get(e.control_id) ?? 0) + 1);
  }
  const responseByControl = new Map(responses.map((r) => [r.control_id, r]));
  const rows = [
    [
      "control_id",
      "far_reference",
      "nist_reference",
      "short_name",
      "status",
      "narrative",
      "evidence_count",
    ],
  ];
  for (const p of playbook) {
    const r = responseByControl.get(p.id);
    rows.push([
      p.id,
      p.farReference,
      p.nistReference,
      p.shortName,
      r?.status ?? "unanswered",
      r?.narrative ?? "",
      String(evidenceCount.get(p.id) ?? 0),
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function buildEvidenceCsv(evidence: EvidenceArtifactRow[]): string {
  const rows = [
    [
      "artifact_id",
      "control_id",
      "filename",
      "mime_type",
      "size_bytes",
      "captured_at",
      "ai_verdict",
      "ai_summary",
      "ai_reviewed_at",
    ],
  ];
  for (const e of evidence) {
    rows.push([
      e.id,
      e.control_id,
      e.filename,
      e.mime_type ?? "",
      String(e.size_bytes ?? ""),
      e.captured_at,
      e.ai_review_verdict ?? "",
      e.ai_review_summary ?? "",
      e.ai_reviewed_at ?? "",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function buildRemediationCsv(plans: RemediationPlanRow[]): string {
  const rows = [
    [
      "control_id",
      "status",
      "target_close_date",
      "gap_summary",
      "planned_actions",
      "created_at",
      "updated_at",
      "closed_at",
    ],
  ];
  for (const p of plans) {
    rows.push([
      p.control_id,
      p.status,
      p.target_close_date,
      p.gap_summary,
      p.planned_actions,
      p.created_at,
      p.updated_at,
      p.closed_at ?? "",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label: string, value: string): string {
  return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

const BID_PACKAGE_CSS = `
  @page { size: letter; margin: 0.75in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 40px 20px; line-height: 1.55; }
  article { max-width: 820px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 48px; }
  h1 { font-size: 28px; margin: 6px 0 0; letter-spacing: -0.01em; }
  h2 { font-size: 18px; margin: 32px 0 12px; letter-spacing: -0.005em; }
  h3 { font-size: 15px; margin: 24px 0 10px; }
  p { margin: 8px 0; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 11px; font-weight: 600; color: #64748b; }
  .subtitle { font-size: 13px; color: #475569; margin-top: 6px; }
  .doc-head { border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 32px; }
  .doc-head.centered { text-align: center; border-bottom: 0; }
  .doc-foot { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
  dl.fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 20px 0 0; }
  dl.fields.two-col { grid-template-columns: repeat(2, 1fr); margin: 28px 0; }
  @media (min-width: 720px) { dl.fields { grid-template-columns: repeat(4, 1fr); } }
  dl.fields dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; font-weight: 600; }
  dl.fields dd { margin: 4px 0 0; font-weight: 600; font-size: 13px; color: #0f172a; }
  .practice { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 10px 0; }
  .practice-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .practice-title { font-weight: 700; font-size: 14px; margin-top: 4px; }
  .practice-desc { font-size: 12px; color: #475569; margin: 6px 0 10px; }
  .pill { background: #f1f5f9; color: #334155; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
  .label { text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; font-weight: 600; color: #64748b; margin-top: 10px; }
  .narrative { white-space: pre-wrap; font-size: 13px; margin: 4px 0 10px; }
  .scope { white-space: pre-wrap; font-size: 13px; }
  .scope-box { border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px 12px; font-size: 12px; margin-top: 6px; white-space: pre-wrap; border-radius: 6px; }
  .muted { color: #64748b; }
  .small { font-size: 11px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
  ol { padding-left: 20px; }
  ol li { margin: 10px 0; }
  ul { padding-left: 20px; margin: 6px 0; }
  ul li { font-size: 13px; margin: 4px 0; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 48px; padding-top: 20px; border-top: 1px solid #cbd5e1; }
  .sign-line { border-bottom: 1px solid #0f172a; height: 32px; margin-bottom: 8px; }
  .strong { font-weight: 600; font-size: 13px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; }
  @media print {
    body { background: white; padding: 0; }
    article { border: 0; padding: 0; max-width: 100%; }
  }
`;
