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

const SYSTEM_PROMPT = `You are a B2B sales-qualification analyst for Custodia, a CMMC Level 1 self-attestation platform for small DoD contractors.

WHO IS CMMC LEVEL 1 FOR?
CMMC L1 is required for ANY company that holds a federal contract handling Federal Contract Information (FCI) — basically every commercial DoD prime above the $10k micro-purchase threshold. The compliance is mandatory but light: 15 controls, self-attested annually. Custodia's customer is the small business that just won DoD work and now realizes they have to figure this out without a compliance team.

THE IDEAL CUSTOMER:
- Small US business, likely 5-500 employees, ~$1M-$50M revenue
- Recently won a federal prime contract (DoD or DoD-adjacent)
- Handles FCI (true for almost any DoD prime, except pure COTS resale)
- Probably does NOT have a CMMC compliance officer yet
- Reachable by cold email at a personal address (not a giant info@ inbox)

KEEP (recommend="keep") if the company plausibly:
- Looks like an SMB by name (LLC, Inc, small-sounding, regional)
- Operates in a NAICS where FCI is the norm: engineering, IT, R&D, defense electronics, aerospace parts, manufacturing, cybersecurity, technical consulting
- Won an award in the $25k-$10M band (sweet spot $100k-$2M)
- Is fresh enough that the compliance clock is ticking (any of last 90 days)

SKIP (recommend="skip") if the company is:
- A megaprime, public engineering/consulting firm, big tech federal arm
  (megaprimes are mostly already filtered upstream, but flag any that slipped through)
- A research university, FFRDC, federal lab
- A government entity itself
- A joint venture (almost always megaprime + megaprime)
- A pure-play hardware/COTS reseller with no FCI handling
- Construction-only with no IT/data work
- Foreign-domiciled

When in doubt: KEEP. We send 30 emails/day; the cost of an extra email is near zero, the cost of a missed lead is real. Bias toward keep when the company name is unfamiliar — unfamiliar = probably small = probably ICP.

OUTPUT FORMAT:
Return a JSON array — one object per candidate, no markdown, no prose outside the JSON. Each object has:
  - internalId (string, matches input)
  - recommend ("keep" | "skip")
  - aiScore (0-100)
  - aiBand ("A" | "B" | "C" | "reject")
  - reasoning (one short sentence, < 25 words, plain English the founder might read)

SCORING:
  A (75-100): textbook ICP — small, unfamiliar name, just won DoD prime in a tech NAICS
  B (50-74):  good fit — probably small, plausible FCI handling
  C (25-49):  marginal — keep if you'd rather have a lead than not
  reject:     do not pursue (megaprimes, JVs, govt, universities)

Aim to recommend="keep" for ANY candidate scoring B or above. We want at least 10 keeps from a typical batch of 30 candidates.`;

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
    max_tokens: 4000,
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
