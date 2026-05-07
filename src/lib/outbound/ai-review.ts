/**
 * AI review agent — the "second pass" on prospect candidates.
 *
 * The rule-based ICP scorer in icp.ts is fast and cheap but can't reason
 * about subtle signals (is this company a real SMB or a megaprime
 * subsidiary? does the company name suggest defense work? is the
 * NAICS-vs-agency combination plausible for FCI handling?).
 *
 * This module sends the rule-based survivors to Claude with full
 * context and asks it to rank them for fit with our ICP:
 *
 *   "small US defense contractor (5–500 employees) that just won a
 *   federal contract, almost certainly handles FCI, but probably
 *   doesn't have a CMMC compliance officer yet"
 *
 * Returns the top N picks with reasoning. The orchestrator persists
 * those as `status='approved'` and skips the rest.
 *
 * Cost: one Claude call per run (batched), ~2k input tokens for 20
 * candidates, ~1k output. Roughly $0.015/run with Sonnet 4.6.
 */

import { getAnthropic, CHAT_MODEL } from "@/lib/anthropic";
import type { AwardRow } from "./usaspending";
import type { IcpScore } from "./icp";

export type ReviewCandidate = {
  award: AwardRow;
  ruleScore: IcpScore;
};

export type ReviewVerdict = {
  /** internalId of the award (matches AwardRow.internalId) */
  internalId: string;
  /** Whether the AI thinks this is a good ICP fit */
  recommend: "keep" | "skip";
  /** AI-assigned 0–100 score */
  aiScore: number;
  /** AI band: A (top), B (good), C (marginal), reject */
  aiBand: "A" | "B" | "C" | "reject";
  /** One-sentence reasoning */
  reasoning: string;
};

export type ReviewResult = {
  verdicts: ReviewVerdict[];
  rawText: string;
  inputTokens: number;
  outputTokens: number;
};

const SYSTEM_PROMPT = `You are a B2B sales-qualification analyst for Custodia, a CMMC compliance platform. Your job is to review federal-contract awardees and decide which ones are the best fit for outbound CMMC Level 1 outreach.

THE IDEAL CUSTOMER PROFILE:
- Small to mid-sized US company (5-500 employees, ~$1M-$50M revenue)
- Just won a federal prime contract (DoD or DoD-adjacent)
- Almost certainly handles Federal Contract Information (FCI)
- Probably does NOT have a dedicated compliance officer yet
- Founder or small leadership team — outreach to a generic info@ box will not work

REJECT IMMEDIATELY:
- Public companies / large enterprises (>$500M revenue)
- Universities, government agencies, federal labs, FFRDCs
- Megaprimes (Lockheed, Raytheon, Boeing, etc.)
- Public engineering megafirms (Tetra Tech, AECOM, Jacobs, HDR, ICF, Parsons, etc.)
- Big consulting firms (Deloitte, Accenture, Booz Allen, etc.)
- Joint ventures of megaprimes (anything with "JV" or "Joint Venture" in name)
- Pure-play hardware-only resellers (no FCI handling)
- Construction-only firms (rare to handle FCI)

PREFER:
- Companies with names suggesting defense tech / aerospace / cyber / engineering / R&D
- Small dollar awards ($100k-$2M) signal SMB primes
- New entrants to the federal market (just one or few awards)
- Niche technical specialties (radar, sensors, autonomous systems, etc.)

OUTPUT FORMAT:
Return a JSON array — one object per candidate, no markdown, no prose outside the JSON. Each object has:
  - internalId (string, matches input)
  - recommend ("keep" | "skip")
  - aiScore (0-100)
  - aiBand ("A" | "B" | "C" | "reject")
  - reasoning (one short sentence, < 25 words)

Score conservatively. Bands:
  A = perfect fit, push to top of outreach queue (typically 75-100)
  B = good fit, second wave (50-74)
  C = marginal, save for future (25-49)
  reject = do not pursue (0-24)`;

function buildUserPrompt(candidates: ReviewCandidate[]): string {
  const rows = candidates.map((c, i) => {
    const a = c.award;
    return `${i + 1}. internalId=${a.internalId}
   Company: ${a.recipientName}
   UEI: ${a.recipientUei ?? "—"}
   State: ${a.recipientStateCode ?? "—"} / ${a.recipientCity ?? "—"}
   NAICS: ${a.naicsCode ?? "—"} ${a.naicsDescription ? `(${a.naicsDescription})` : ""}
   Award: $${a.awardAmount.toLocaleString()} on ${a.actionDate ?? "—"}
   Awarded by: ${a.awardingAgencyName ?? "—"} / ${a.awardingSubAgencyName ?? "—"}
   Rule-score: ${c.ruleScore.score} (${c.ruleScore.band}) — ${c.ruleScore.reasons.join("; ")}`;
  });
  return `Review these ${candidates.length} federal-contract awardees and rank them for CMMC L1 outreach fit. Return ONLY a JSON array, no other text.

${rows.join("\n\n")}`;
}

/**
 * Strip optional ```json fences and parse. Tolerant of whitespace and
 * accidental prose around the array.
 */
function extractJsonArray(text: string): unknown {
  let t = text.trim();
  // Strip code fences if present
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  // Find the first [ and last ]
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in AI response");
  }
  return JSON.parse(t.slice(start, end + 1));
}

function isVerdict(x: unknown): x is ReviewVerdict {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.internalId === "string" &&
    (o.recommend === "keep" || o.recommend === "skip") &&
    typeof o.aiScore === "number" &&
    (o.aiBand === "A" || o.aiBand === "B" || o.aiBand === "C" || o.aiBand === "reject") &&
    typeof o.reasoning === "string"
  );
}

/**
 * Send candidates to Claude and parse its ranked verdicts. Throws on
 * Anthropic SDK errors; returns empty verdicts (with rawText) on parse
 * failures so the orchestrator can fall back to rule-score order.
 */
export async function reviewProspectsWithAI(
  candidates: ReviewCandidate[],
): Promise<ReviewResult> {
  if (candidates.length === 0) {
    return { verdicts: [], rawText: "", inputTokens: 0, outputTokens: 0 };
  }

  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(candidates) }],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let verdicts: ReviewVerdict[] = [];
  try {
    const parsed = extractJsonArray(rawText);
    if (Array.isArray(parsed)) {
      verdicts = parsed.filter(isVerdict);
    }
  } catch {
    // Parse failure: empty verdicts. Caller can decide whether to
    // proceed on rule-score alone or fail the run.
  }

  return {
    verdicts,
    rawText,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };
}

/**
 * Convenience: run AI review and return only the keep-recommended
 * verdicts sorted by aiScore desc, capped at maxKeep.
 */
export async function rankAndPick(
  candidates: ReviewCandidate[],
  maxKeep: number,
): Promise<{ winners: ReviewVerdict[]; allVerdicts: ReviewVerdict[]; rawText: string; tokens: { input: number; output: number } }> {
  const result = await reviewProspectsWithAI(candidates);
  const keepers = result.verdicts
    .filter((v) => v.recommend === "keep")
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, maxKeep);
  return {
    winners: keepers,
    allVerdicts: result.verdicts,
    rawText: result.rawText,
    tokens: { input: result.inputTokens, output: result.outputTokens },
  };
}
