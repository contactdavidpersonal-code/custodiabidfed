import { auth } from "@clerk/nextjs/server";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import {
  getAssessmentForUser,
  getBusinessProfile,
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
import {
  resolveOrgBranding,
  displayUrl,
  type OrgBranding,
} from "@/lib/org-branding";
import {
  auditContextFromRequest,
  recordAuditEvent,
} from "@/lib/security/audit-log";

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

  const [responses, evidence, remediationPlans, profile] = await Promise.all([
    listResponsesForAssessment(id),
    listEvidenceForAssessment(id),
    listRemediationPlansForAssessment(id),
    getBusinessProfile(ctx.organization.id),
  ]);

  const zip = new JSZip();
  const org = ctx.organization;
  const a = ctx.assessment;
  const branding = resolveOrgBranding(
    org,
    (profile?.data ?? {}) as Record<string, unknown>,
  );
  const generatedAt = new Date().toISOString();

  zip.file(
    "00-README.md",
    buildReadme({ org, assessment: a, generatedAt, draft: forceDraft }),
  );
  zip.file(
    "01-SSP.html",
    buildSspHtml({
      org,
      assessment: a,
      responses,
      evidence,
      generatedAt,
      branding,
    }),
  );
  zip.file(
    "02-Affirmation.html",
    buildAffirmationHtml({ org, assessment: a, generatedAt, branding }),
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

  // Audit every export. The bid-package contains the full SSP, every
  // narrative, and every evidence file — it's the most concentrated form
  // of org-sensitive data we produce. Track who pulls it and when.
  const auditCtx = auditContextFromRequest(req);
  await recordAuditEvent({
    action: "bid_package.exported",
    userId,
    organizationId: org.id,
    resourceType: "assessment",
    resourceId: id,
    ip: auditCtx.ip,
    userAgent: auditCtx.userAgent,
    metadata: {
      draft: forceDraft,
      attested: a.status === "attested",
      evidenceCount: evidence.length,
      sizeBytes: buf.length,
    },
  });

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
      ? "**Affirmation outcome:** Implements all 15 CMMC Level 1 basic safeguarding requirements (FAR 52.204-21(b)(1)(i)–(b)(1)(xv); 59 NIST SP 800-171A assessment objectives per Assessment Guide v2.13 / 32 CFR § 170.24). CMMC Status: Final Level 1 (Self). Eligible to file a positive affirmation in SPRS and to represent compliance under DFARS 252.204-7025."
      : "**Affirmation outcome:** Does NOT implement all 15 CMMC Level 1 basic safeguarding requirements. Do not file a positive affirmation until remediation closes the gap."
    : "**Affirmation outcome:** Pending — not yet signed.";

  return `# ${org.name} — CMMC Level 1 Bid-Ready Package

**Cycle:** ${assessment.cycle_label}
**Fiscal year:** FY${assessment.fiscal_year}
**Generated:** ${generatedAt}
${draft ? "**⚠  DRAFT — not signed. Do not submit to SPRS.**\n" : ""}${signedLine}
${outcomeLine}

> CMMC Level 1 affirmation is **binary**: every one of the 15 basic safeguarding requirements at FAR 52.204-21(b)(1)(i)–(b)(1)(xv) must roll up to MET (32 CFR § 170.24 — each of the 59 NIST SP 800-171A assessment objectives MET or NOT APPLICABLE) or you don't. There is no partial-credit score for L1. The 110-point NIST SP 800-171 scoring methodology applies to **CMMC Level 2 / DFARS 252.204-7012**, not L1.

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
6. Affirm: ${implementsAll ? "**YES** — implements all 15 CMMC Level 1 basic safeguarding requirements at FAR 52.204-21(b)(1)(i)–(b)(1)(xv); CMMC Status: Final Level 1 (Self)" : "[Do NOT affirm yes until all 15 requirements are MET]"}.
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
  branding: OrgBranding;
}): string {
  const { org, assessment, responses, evidence, generatedAt, branding } = input;
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
      ).toISOString().slice(0, 10)} that the information in this plan is accurate and that ${esc(org.name)} implements all 15 CMMC Level 1 safeguarding requirements (FAR 52.204-21(b)(1)(i)–(xv)) as described.</p>`
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
  ${renderBrandBar(branding, assessment)}
  <div class="doc-body">
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
    <h2>3. Implementation of the safeguarding requirements</h2>
    <p class="muted small">For each of the 15 FAR 52.204-21(b)(1) safeguarding requirements, the narrative below describes how ${esc(org.name)} implements the practice, with supporting evidence on file in the <code>evidence/</code> folder.</p>
    ${domainSections}
  </section>

  <footer class="doc-foot">
    Generated by Custodia on ${new Date(generatedAt).toLocaleDateString()}. This System Security Plan is based on the self-assessment conducted by ${esc(org.name)} against the 15 CMMC Level 1 safeguarding requirements defined in FAR 52.204-21(b)(1)(i)–(xv).
  </footer>
  </div>
</article>
</body>
</html>`;
}

function buildAffirmationHtml(input: {
  org: OrganizationRow;
  assessment: AssessmentRow;
  generatedAt: string;
  branding: OrgBranding;
}): string {
  const { org, assessment, generatedAt, branding } = input;
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
  ${renderBrandBar(branding, assessment)}
  <div class="doc-body">
  <header class="doc-head centered">
    <div class="eyebrow">Annual Affirmation of Compliance</div>
    <h1>CMMC Level 1 — Self-Assessment</h1>
    <p class="subtitle">Pursuant to 32 CFR § 170.22 and the terms of FAR 52.204-21</p>
  </header>

  <section class="body">
    <p>I, <strong>${esc(assessment.affirmed_by_name ?? "[Senior Official Name]")}</strong>${assessment.affirmed_by_title ? `, ${esc(assessment.affirmed_by_title)}` : ", [Title]"} of <strong>${esc(org.name)}</strong>${org.entity_type ? ` (${esc(org.entity_type)})` : ""}, a Senior Official with authority to affirm on behalf of the organization, hereby affirm the following:</p>
    <ol>
      <li>${esc(org.name)} has conducted a self-assessment of its compliance with the 15 safeguarding requirements set forth at FAR 52.204-21(b)(1)(i)–(xv) (the "CMMC Level 1" requirements), consistent with the methodology described in 32 CFR § 170.15.</li>
      <li>The scope of this self-assessment covers all information systems that process, store, or transmit Federal Contract Information (FCI), described in the accompanying System Security Plan as:<div class="scope-box">${esc(org.scoped_systems ?? "[Scope pending — complete the business profile.]")}</div></li>
      <li>To the best of my knowledge, ${esc(org.name)} implements each of the 15 CMMC Level 1 safeguarding requirements, and the representations made in the associated System Security Plan are accurate and complete as of the date of this affirmation.</li>
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
  </div>
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function field(label: string, value: string): string {
  return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

const BID_PACKAGE_CSS = `
  @page { size: letter; margin: 0.75in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #10231d; background: #f5f8f6; margin: 0; padding: 40px 20px; line-height: 1.55; }
  article { max-width: 820px; margin: 0 auto; background: white; border: 1px solid #cfe3d9; padding: 0; }
  .brand-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 48px; background: #0a1814; color: #ffffff; border-bottom: 4px solid #f59e0b; }
  .brand-bar .bb-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .brand-bar img.bb-logo { height: 44px; width: auto; background: #ffffff; padding: 4px; }
  .brand-bar .bb-name { font-family: Georgia, "Iowan Old Style", "Source Serif Pro", serif; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; }
  .brand-bar .bb-meta { margin-top: 4px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em; color: #cfe3d9; }
  .brand-bar .bb-right { text-align: right; }
  .brand-bar .bb-verifier { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #f59e0b; }
  .brand-bar .bb-verifier::before { content: ""; display: inline-block; width: 6px; height: 6px; background: #f59e0b; border-radius: 999px; }
  .brand-bar .bb-id { margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; color: #cfe3d9; }
  .doc-body { padding: 40px 48px 48px; }
  h1, h2, h3 { font-family: Georgia, "Iowan Old Style", "Source Serif Pro", serif; color: #10231d; }
  h1 { font-size: 30px; margin: 6px 0 0; letter-spacing: -0.015em; line-height: 1.15; }
  h2 { font-size: 18px; margin: 32px 0 12px; letter-spacing: -0.005em; padding-left: 12px; border-left: 4px solid #10231d; }
  h3 { font-size: 15px; margin: 24px 0 10px; }
  p { margin: 8px 0; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 11px; font-weight: 700; color: #2f8f6d; }
  .subtitle { font-size: 13px; color: #5a7d70; margin-top: 8px; }
  .doc-head { border-bottom: 1px solid #cfe3d9; padding-bottom: 24px; margin-bottom: 32px; }
  .doc-head.centered { text-align: center; border-bottom: 0; }
  .doc-head.centered h2 { border-left: 0; padding-left: 0; }
  .doc-foot { margin-top: 40px; padding-top: 20px; border-top: 1px solid #cfe3d9; font-size: 11px; color: #5a7d70; }
  dl.fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin: 20px 0 0; }
  dl.fields.two-col { grid-template-columns: repeat(2, 1fr); margin: 28px 0; }
  @media (min-width: 720px) { dl.fields { grid-template-columns: repeat(4, 1fr); } }
  dl.fields dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: #5a7d70; font-weight: 700; }
  dl.fields dd { margin: 4px 0 0; font-weight: 700; font-size: 13px; color: #10231d; }
  .practice { border: 1px solid #cfe3d9; border-left: 4px solid #2f8f6d; padding: 14px 16px; margin: 10px 0; background: #ffffff; }
  .practice-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .practice-title { font-family: Georgia, "Iowan Old Style", "Source Serif Pro", serif; font-weight: 700; font-size: 15px; margin-top: 4px; color: #10231d; }
  .practice-desc { font-size: 12px; color: #5a7d70; margin: 6px 0 10px; font-style: italic; }
  .pill { background: #e8f1ec; color: #0e2a23; padding: 3px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; border: 1px solid #cfe3d9; }
  .label { text-transform: uppercase; letter-spacing: 0.14em; font-size: 10px; font-weight: 700; color: #5a7d70; margin-top: 10px; }
  .narrative { white-space: pre-wrap; font-size: 13px; margin: 4px 0 10px; }
  .scope { white-space: pre-wrap; font-size: 13px; }
  .scope-box { border: 1px solid #cfe3d9; border-left: 4px solid #10231d; background: #f5f8f6; padding: 12px 14px; font-size: 12px; margin-top: 8px; white-space: pre-wrap; }
  .muted { color: #5a7d70; }
  .small { font-size: 11px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #5a7d70; }
  ol { padding-left: 20px; }
  ol li { margin: 10px 0; }
  ul { padding-left: 20px; margin: 6px 0; }
  ul li { font-size: 13px; margin: 4px 0; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 48px; padding-top: 20px; border-top: 1px solid #cfe3d9; }
  .sign-line { border-bottom: 1.5px solid #10231d; height: 32px; margin-bottom: 8px; }
  .strong { font-weight: 700; font-size: 13px; color: #10231d; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: #f5f8f6; border: 1px solid #cfe3d9; padding: 1px 5px; }
  @media print {
    body { background: white; padding: 0; }
    article { border: 0; max-width: 100%; }
    .brand-bar { padding: 14px 0 12px; }
    .doc-body { padding: 24px 0 0; }
  }
`;

/**
 * Render the customer-branded header bar used at the top of the SSP and the
 * affirmation memo. The customer's logo + company info appear on the left;
 * a "Verified by Custodia · {verification id}" pill anchors the right so
 * primes can vet the document at /verified/{slug}.
 */
function renderBrandBar(
  branding: OrgBranding,
  assessment: AssessmentRow,
): string {
  const metaLine = [
    branding.locationLine,
    displayUrl(branding.website),
    branding.phone,
  ]
    .filter(Boolean)
    .join(" · ");
  const logo = branding.logoUrl
    ? `<img class="bb-logo" src="${esc(branding.logoUrl)}" alt="${esc(branding.companyName)} logo" />`
    : "";
  const meta = metaLine ? `<div class="bb-meta">${esc(metaLine)}</div>` : "";
  const verificationId = assessment.custodia_verification_id
    ? `<div class="bb-id">${esc(assessment.custodia_verification_id)}</div>`
    : "";
  return `<div class="brand-bar">
    <div class="bb-left">
      ${logo}
      <div>
        <div class="bb-name">${esc(branding.companyName)}</div>
        ${meta}
      </div>
    </div>
    <div class="bb-right">
      <div class="bb-verifier">CMMC Level 1 · Verified by Custodia</div>
      ${verificationId}
    </div>
  </div>`;
}
