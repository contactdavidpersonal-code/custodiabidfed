import {
  evidenceVerdicts,
  getSql,
  type EvidenceVerdict,
} from "@/lib/db";
import { VISION_MODEL, getAnthropic } from "@/lib/anthropic";
import { playbookById } from "@/lib/playbook";

export type EvidenceReviewResult = {
  verdict: EvidenceVerdict;
  summary: string;
  mapped_controls: string[];
};

const REPORT_REVIEW_TOOL = {
  name: "report_review",
  description:
    "Record your verdict on this evidence artifact. Call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: evidenceVerdicts as unknown as string[],
        description:
          "sufficient = clearly evidences the control as claimed. insufficient = is the right KIND of artifact but weak (missing timestamp, ambiguous, outdated). unclear = you cannot tell without more context. not_relevant = does not evidence any CMMC L1 practice (random photos, unrelated screenshots, etc.)",
      },
      summary: {
        type: "string",
        description:
          "2-3 sentences. State what you see, then why it does or doesn't pass for the claimed control. If insufficient or not_relevant, say exactly what would fix it.",
      },
      mapped_controls: {
        type: "array",
        items: { type: "string" },
        description:
          "Control IDs (e.g. 'AC.L1-3.1.1') that this artifact genuinely evidences. Empty if not_relevant. The claimed control MAY or MAY NOT be in this list — your judgment.",
      },
    },
    required: ["verdict", "summary", "mapped_controls"],
  },
};

/**
 * Given an uploaded evidence artifact, run Sonnet with vision to judge
 * whether it passes for the claimed control. Stores the verdict on the
 * evidence_artifacts row. See feedback_evidence_gating.md — every upload
 * must be reviewed before it can count toward attestation.
 */
export async function reviewEvidenceArtifact(input: {
  artifactId: string;
  claimedControlId: string;
  blobUrl: string;
  mimeType: string | null;
  filename: string;
  companyContext?: string; // e.g. what the business does; steers the verdict
}): Promise<EvidenceReviewResult> {
  const entry = playbookById[input.claimedControlId];
  if (!entry) {
    throw new Error(`Unknown control: ${input.claimedControlId}`);
  }

  const isImage = (input.mimeType ?? "").startsWith("image/");
  const isPdf = input.mimeType === "application/pdf";

  // For formats we can't visually review, bail to 'unclear' rather than
  // pretending. Attestation is still blocked until a human overrides.
  if (!isImage && !isPdf) {
    const result: EvidenceReviewResult = {
      verdict: "unclear",
      summary: `Auto-review only supports images and PDFs today. This file (${input.mimeType ?? "unknown type"}) needs a human or officer review before it can count toward attestation.`,
      mapped_controls: [],
    };
    await persistReview(input.artifactId, result, "none");
    return result;
  }

  const client = getAnthropic();

  const userPrompt = [
    `You are the Custodia Compliance Officer reviewing a piece of evidence a user just uploaded for CMMC Level 1 practice **${entry.id} — ${entry.shortName}**.`,
    ``,
    `**What this practice requires (plain English):** ${entry.plainEnglish}`,
    `**FAR reference:** ${entry.farReference}`,
    `**What would pass:** ${entry.providerGuidance.map((g) => `(${g.label}) ${g.capture}`).join(" · ")}`,
    ``,
    input.companyContext
      ? `**Business context:** ${input.companyContext}`
      : `**Business context:** not yet captured — judge the artifact on its own merits.`,
    ``,
    `**Filename the user gave it:** ${input.filename}`,
    ``,
    `Review the attached artifact. Be strict. A cat picture, a random desktop screenshot, a blank page, or anything that doesn't clearly evidence the claimed practice is NOT sufficient. When in doubt, err toward 'insufficient' with specific guidance on what would fix it.`,
    ``,
    `Call the \`report_review\` tool exactly once with your verdict. Do not output any other text.`,
  ].join("\n");

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "url"; url: string };
      }
    | {
        type: "document";
        source: { type: "url"; url: string };
      }
  > = [{ type: "text", text: userPrompt }];

  if (isImage) {
    content.push({ type: "image", source: { type: "url", url: input.blobUrl } });
  } else {
    content.push({
      type: "document",
      source: { type: "url", url: input.blobUrl },
    });
  }

  let result: EvidenceReviewResult;
  try {
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 512,
      tools: [REPORT_REVIEW_TOOL],
      tool_choice: { type: "tool", name: "report_review" },
      messages: [
        {
          role: "user",
          content: content as Parameters<
            typeof client.messages.create
          >[0]["messages"][0]["content"],
        },
      ],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Model did not return a tool_use block");
    }
    result = parseToolInput(toolBlock.input);
  } catch (err) {
    // On any vision failure, fall back to 'unclear' — do NOT let an error
    // silently mark evidence as sufficient. The UI will prompt a re-review.
    const msg = err instanceof Error ? err.message : String(err);
    result = {
      verdict: "unclear",
      summary: `Automated review hit an error: ${msg}. Try re-uploading or ask the officer to re-review.`,
      mapped_controls: [],
    };
  }

  await persistReview(input.artifactId, result, VISION_MODEL);
  return result;
}

function parseToolInput(input: unknown): EvidenceReviewResult {
  const obj = (input ?? {}) as Record<string, unknown>;
  const verdictRaw = String(obj.verdict ?? "unclear");
  const verdict: EvidenceVerdict = (
    evidenceVerdicts as readonly string[]
  ).includes(verdictRaw)
    ? (verdictRaw as EvidenceVerdict)
    : "unclear";
  const summary =
    typeof obj.summary === "string" && obj.summary.trim().length > 0
      ? obj.summary.trim()
      : "No summary provided by the model.";
  const mapped = Array.isArray(obj.mapped_controls)
    ? (obj.mapped_controls as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return { verdict, summary, mapped_controls: mapped };
}

async function persistReview(
  artifactId: string,
  result: EvidenceReviewResult,
  model: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE evidence_artifacts
    SET ai_review_verdict = ${result.verdict},
        ai_review_summary = ${result.summary},
        ai_review_mapped_controls = ${result.mapped_controls},
        ai_reviewed_at = NOW(),
        ai_review_model = ${model}
    WHERE id = ${artifactId}
  `;
}
