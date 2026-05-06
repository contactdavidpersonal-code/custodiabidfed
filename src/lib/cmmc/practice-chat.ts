/**
 * Hybrid chat+evidence flow for a single CMMC L1 practice.
 *
 * Architecture: per-(assessment, control) conversation persisted in
 * `practice_conversations`. Charlie is grounded in the official CMMC L1
 * Self-Assessment Guide v2.0 (Dec 2021) and NIST 800-171A — never paraphrases
 * the standard, always asks shaped questions to map the user's reality onto
 * each assessment objective.
 *
 * The flow:
 *   1. User opens a practice → chat thread loads with Charlie's opener.
 *   2. Charlie asks shaped questions, one at a time, to fill each objective.
 *   3. After each user message, server runs a verification pass that grades
 *      every objective letter as covered/partial/missing based on transcript
 *      + currently-attached evidence.
 *   4. When every required objective is "covered", the user can lock the
 *      practice as MET; the transcript + evidence bundle freezes as a
 *      versioned snapshot.
 *
 * This file is the prototype for AC.L1-3.1.1. The shape is identical for
 * every other practice — only `practice-spec.ts` data changes.
 */

import { CHAT_MODEL, getAnthropic } from "@/lib/anthropic";
import { getSql } from "@/lib/db";
import { getPracticeSpec, type PracticeSpec } from "@/lib/cmmc/practice-spec";
import { listEvidenceForControl } from "@/lib/assessment";

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  /** server timestamp (ISO) */
  at: string;
};

export type ObjectiveVerdict =
  | { status: "covered"; reason: string }
  | { status: "partial"; reason: string; missing: string }
  | { status: "missing"; reason: string };

export type PracticeConversationRow = {
  id: string;
  assessment_id: string;
  control_id: string;
  messages: ChatMessage[];
  objective_verdicts: Record<string, ObjectiveVerdict>;
  verdict_updated_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrCreatePracticeConversation(
  assessmentId: string,
  controlId: string,
): Promise<PracticeConversationRow> {
  const sql = getSql();
  const existing = (await sql`
    SELECT id, assessment_id, control_id, messages, objective_verdicts,
           verdict_updated_at, locked_at, created_at, updated_at
    FROM practice_conversations
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
    LIMIT 1
  `) as PracticeConversationRow[];
  if (existing[0]) return existing[0];

  const spec = getPracticeSpec(controlId);
  const opener = spec ? buildOpener(spec) : "Hi, I'm Charlie. Let's walk through this practice together.";
  const seed: ChatMessage[] = [
    { role: "assistant", text: opener, at: new Date().toISOString() },
  ];
  const inserted = (await sql`
    INSERT INTO practice_conversations (assessment_id, control_id, messages)
    VALUES (${assessmentId}, ${controlId}, ${JSON.stringify(seed)}::jsonb)
    RETURNING id, assessment_id, control_id, messages, objective_verdicts,
              verdict_updated_at, locked_at, created_at, updated_at
  `) as PracticeConversationRow[];
  return inserted[0];
}

export async function appendPracticeMessages(
  assessmentId: string,
  controlId: string,
  toAppend: ChatMessage[],
): Promise<PracticeConversationRow> {
  const sql = getSql();
  const updated = (await sql`
    UPDATE practice_conversations
    SET messages = messages || ${JSON.stringify(toAppend)}::jsonb,
        updated_at = NOW()
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
    RETURNING id, assessment_id, control_id, messages, objective_verdicts,
              verdict_updated_at, locked_at, created_at, updated_at
  `) as PracticeConversationRow[];
  return updated[0];
}

export async function setObjectiveVerdicts(
  assessmentId: string,
  controlId: string,
  verdicts: Record<string, ObjectiveVerdict>,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE practice_conversations
    SET objective_verdicts = ${JSON.stringify(verdicts)}::jsonb,
        verdict_updated_at = NOW(),
        updated_at = NOW()
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
  `;
}

export async function lockPractice(
  assessmentId: string,
  controlId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE practice_conversations
    SET locked_at = NOW(), updated_at = NOW()
    WHERE assessment_id = ${assessmentId}
      AND control_id = ${controlId}
  `;
}

function buildOpener(spec: PracticeSpec): string {
  // This text seeds the per-practice transcript and ends up in the SSP as
  // the assessor-readable opening of the conversation. The user never sees
  // it directly — the live chat happens in the Charlie rail. Keep it tight
  // and assessor-oriented.
  return [
    `[Guided walkthrough — ${spec.controlId} ${spec.shortName}]`,
    ``,
    `Control statement: ${spec.statement}`,
    ``,
    `Conversation captured below maps the operator's environment onto each NIST 800-171A objective letter [a]–[${spec.objectives[spec.objectives.length - 1]?.letter ?? "z"}]. Evidence artifacts attached to this practice are listed in the SSP after the transcript.`,
  ].join("\n");
}

/**
 * Build the per-practice system prompt. Charlie is grounded in the verbatim
 * CMMC L1 SAG text + NIST 800-171A objectives. He never paraphrases the
 * standard and always shapes questions toward filling missing objectives.
 */
export function buildPracticeSystemPrompt(spec: PracticeSpec, evidenceSummary: string): string {
  const objectivesList = spec.objectives
    .map((o) => `  [${o.letter}] ${o.text}`)
    .join("\n");
  const slotsList = spec.evidenceSlots
    .map(
      (s) =>
        `  - ${s.label} (${s.required ? "required" : "optional"}; satisfies [${s.satisfies.join(", ")}]): ${s.hint}`,
    )
    .join("\n");
  return `You are Charlie, a senior CMMC Level 1 compliance consultant embedded in the Custodia platform. Right now you are walking ONE user through ONE practice: **${spec.controlId} — ${spec.shortName}**.

## Authority
You are grounded in the verbatim CMMC Self-Assessment Guide — Level 1, v2.0 (Dec 2021) and NIST SP 800-171A. The text below is the OFFICIAL standard. Never paraphrase it incorrectly. When the user asks "what does the standard actually say?", quote it directly.

## The control statement (verbatim, ${spec.keyReferences.join(" / ")})
"${spec.statement}"

## NIST 800-171A assessment objectives — the auditor must be able to determine if:
${objectivesList}

## Further discussion (from the SAG)
${spec.furtherDiscussion}

## Evidence slots a CMMC assessor will accept
${slotsList}

## Currently attached evidence
${evidenceSummary || "(no evidence uploaded yet)"}

## How you behave
- ONE question at a time. Plain English. No jargon without defining it.
- The user is not a security expert. Assume zero prior knowledge.
- Your job: convert the user's plain description of their business into a clean mapping of each objective letter [a]/[b]/[c]/... onto reality.
- Acknowledge what they tell you, then ask the next thing you need. Don't lecture.
- When you have enough information for an objective, briefly note "Got what I need for [letter]" and move on.
- When the user is missing a required artifact (e.g. they have no roster), tell them concretely what to upload, AND offer to draft it for them ("If you want, I can generate a starter roster CSV from what you've told me — you'd review and approve it").
- NEVER mark the practice MET on your own. The platform handles that — you just gather facts.
- If the user asks something outside this practice (Level 2, DFARS, CUI, other practices), say "I'll flag that for after we lock this one in" and pull them back.
- If the user is clearly out of scope (handles CUI, has a complex multi-tenant cloud, doesn't actually have FCI), say so plainly and recommend they escalate to a Custodia Compliance Officer.
- Keep replies short — usually 2-5 sentences. Use a tight numbered list when you have multiple items. No emojis.

## Tone
Warm, direct, competent. You are a senior compliance professional, not a chatbot. The user should feel like they're talking to someone who will get them through this — not someone reading a script.`;
}

/**
 * Send a user message and stream Charlie's response. Non-streaming for the
 * prototype (returns the full assistant text). Streaming can be layered on
 * later by switching to messages.stream().
 */
export async function runPracticeTurn(args: {
  assessmentId: string;
  controlId: string;
  userMessage: string;
}): Promise<{ assistantText: string }> {
  const spec = getPracticeSpec(args.controlId);
  if (!spec) throw new Error(`No practice spec for ${args.controlId}`);

  const conv = await getOrCreatePracticeConversation(args.assessmentId, args.controlId);
  const evidenceSummary = await summarizeEvidence(args.assessmentId, args.controlId);
  const systemPrompt = buildPracticeSystemPrompt(spec, evidenceSummary);

  const history = conv.messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));
  history.push({ role: "user" as const, content: args.userMessage });

  const client = getAnthropic();
  const completion = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 600,
    // Cache the practice system prompt — it embeds the full spec (objectives,
    // examples, guardrails) and is stable across every turn for this control,
    // so caching saves ~2K input tokens per follow-up turn.
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: history,
  });
  const block = completion.content.find((c) => c.type === "text");
  const assistantText = block && block.type === "text" ? block.text : "(no response)";

  const now = new Date().toISOString();
  await appendPracticeMessages(args.assessmentId, args.controlId, [
    { role: "user", text: args.userMessage, at: now },
    { role: "assistant", text: assistantText, at: now },
  ]);

  return { assistantText };
}

async function summarizeEvidence(assessmentId: string, controlId: string): Promise<string> {
  const items = await listEvidenceForControl(assessmentId, controlId);
  if (items.length === 0) return "";
  return items
    .map((e) => {
      const verdict = e.ai_review_verdict ?? "pending";
      const tags = e.tagged_objectives.length ? ` [tagged: ${e.tagged_objectives.join(",")}]` : "";
      return `- ${e.filename} (verdict: ${verdict}${tags})`;
    })
    .join("\n");
}

/**
 * Grade each objective letter as covered / partial / missing based on the
 * conversation transcript + attached evidence. Cached on the row; re-run
 * on every user message and every evidence upload. The verdict drives the
 * "Mark as MET" gate on the client.
 */
export async function verifyPracticeObjectives(args: {
  assessmentId: string;
  controlId: string;
}): Promise<Record<string, ObjectiveVerdict>> {
  const spec = getPracticeSpec(args.controlId);
  if (!spec) throw new Error(`No practice spec for ${args.controlId}`);

  const conv = await getOrCreatePracticeConversation(args.assessmentId, args.controlId);
  const evidenceSummary = await summarizeEvidence(args.assessmentId, args.controlId);

  if (conv.messages.length <= 1) {
    // Only the opener — every objective is missing.
    const empty: Record<string, ObjectiveVerdict> = {};
    for (const obj of spec.objectives) {
      empty[obj.letter] = { status: "missing", reason: "Conversation hasn't started yet." };
    }
    await setObjectiveVerdicts(args.assessmentId, args.controlId, empty);
    return empty;
  }

  const transcript = conv.messages
    .map((m) => `${m.role === "user" ? "USER" : "CHARLIE"}: ${m.text}`)
    .join("\n\n");

  // The static prefix is identical across every grading run for a given
  // control — split it out so we can cache it. Only the transcript +
  // evidence summary actually vary turn-to-turn.
  const stablePrefix = `You are a CMMC Level 1 third-party assessor (CCA) grading whether each NIST 800-171A assessment objective for **${spec.controlId} — ${spec.shortName}** is covered by the conversation + evidence below.

## Control statement
${spec.statement}

## Objectives to grade
${spec.objectives.map((o) => `  [${o.letter}] ${o.text}`).join("\n")}

## Your task
For EACH objective letter, return one of:
- "covered" — the conversation OR evidence clearly establishes this objective. Cite what.
- "partial" — there is some mapping but a key piece is missing. Say what's missing.
- "missing" — nothing in the transcript or evidence speaks to this objective.

Be strict. A user describing a setup verbally is NOT enough on its own — for objectives that require a list (users, devices, processes), an artifact must be attached with verdict 'sufficient' or 'unclear'. For objectives about enforcement, either a screenshot/config OR an explicit description of the enforcement mechanism is needed.

Return JSON only, exactly this shape:
{
  "verdicts": {
    "a": { "status": "covered" | "partial" | "missing", "reason": "...", "missing": "..." },
    "b": { ... },
    ...
  }
}
The "missing" field is required only for "partial" status; for "covered"/"missing" omit it or set to "".`;

  const dynamicPart = `## Conversation transcript
${transcript}

## Attached evidence
${evidenceSummary || "(no evidence attached)"}`;

  const client = getAnthropic();
  const completion = await client.messages.create({
    // Grading is a deterministic JSON-classification task — Haiku 4.5 handles
    // it at ~1/5 the cost of Sonnet with no measurable quality drop. The
    // assessor system prompt + spec prefix are cached for repeat grading.
    model: "claude-haiku-4-5",
    max_tokens: 1200,
    system: [
      {
        type: "text",
        text: "You are a strict CMMC L1 assessor. You output VALID JSON only — no prose, no markdown fences. Your verdicts are conservative: 'covered' requires concrete evidence, not just user assertions for list-shaped objectives.",
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: stablePrefix,
            cache_control: { type: "ephemeral" as const },
          },
          { type: "text", text: dynamicPart },
        ],
      },
    ],
  });
  const block = completion.content.find((c) => c.type === "text");
  const text = block && block.type === "text" ? block.text : "{}";
  const parsed = safeJsonParse(text);
  const rawVerdicts = (parsed?.verdicts ?? {}) as Record<string, Partial<ObjectiveVerdict>>;

  const verdicts: Record<string, ObjectiveVerdict> = {};
  for (const obj of spec.objectives) {
    const v = rawVerdicts[obj.letter];
    if (v && (v.status === "covered" || v.status === "partial" || v.status === "missing")) {
      if (v.status === "partial") {
        verdicts[obj.letter] = {
          status: "partial",
          reason: v.reason ?? "",
          missing: (v as { missing?: string }).missing ?? "",
        };
      } else {
        verdicts[obj.letter] = { status: v.status, reason: v.reason ?? "" };
      }
    } else {
      verdicts[obj.letter] = { status: "missing", reason: "Could not be evaluated." };
    }
  }
  await setObjectiveVerdicts(args.assessmentId, args.controlId, verdicts);
  return verdicts;
}

function safeJsonParse(text: string): { verdicts?: unknown } | null {
  try {
    // Strip ``` fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function isFullyCovered(
  verdicts: Record<string, ObjectiveVerdict>,
  spec: PracticeSpec,
): boolean {
  return spec.objectives.every((o) => verdicts[o.letter]?.status === "covered");
}
