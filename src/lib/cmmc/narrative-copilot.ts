/**
 * Tier 3: SSP Narrative Copilot.
 *
 * Per-control ghostwriter that produces org-specific, assessor-grade
 * narrative text for the SSP. Backbone for the `draft_control_narrative`,
 * `interview_for_control_narrative`, `critique_control_narrative`, and
 * `bulk_draft_remaining_narratives` Charlie tools.
 *
 * Design notes
 * ────────────
 * • Org voice. Drafts are written in first-person company voice ("Acme
 *   Defense limits administrative access…"), not the wishy-washy
 *   "The organization shall…" template phrasing that telegraphs an AI
 *   slop SSP to any C3PAO assessor.
 * • Grounded. Every Claude call is given: org row (name, NAICS,
 *   entity_type, scoped_systems), scope profile narrative, control text
 *   (FAR + NIST verbatim), and the filenames of evidence the user has
 *   already attached to this control. We refuse to draft if the org has
 *   literally zero context — the interview tool prompts for it instead.
 * • Slop blocklist. After Claude returns, we hard-check the draft for
 *   phrases that scream template ("shall implement", "industry standard",
 *   "as appropriate", "where applicable"). If hit, we regenerate once
 *   with an explicit "don't use that phrase" instruction.
 * • Conversational interview. No fixed N. Claude decides when it has
 *   enough to draft via a `{type:"ready"}` signal in its response.
 * • Critique returns weaknesses list + ready boolean — no numeric score
 *   (scores invite gaming).
 *
 * Tenant scoping
 * ──────────────
 * Every public function requires `organizationId` and writes/reads only
 * rows scoped to that org. Callers must additionally verify the
 * `assessment_id` belongs to the org (the tool handlers use
 * `getAssessmentForUser` to do that before invoking us).
 */

import { createHash } from "node:crypto";

import { getAnthropic, metadataForOrg, CHAT_MODEL } from "@/lib/anthropic";
import { getSql } from "@/lib/db";
import {
  getBusinessProfile,
  getResponse,
  listEvidenceForControl,
  type ControlResponseRow,
  type EvidenceArtifactRow,
} from "@/lib/assessment";
import { getScopeProfile } from "@/lib/cmmc/boundary";
import { lookupCitation, type ControlCitation } from "@/lib/regulations";

// Use Haiku for cheap chat turns (interview questions); Sonnet for drafting
// and critique where word choice matters. Both go through getAnthropic().
const INTERVIEW_MODEL = "claude-haiku-4-5";
const DRAFT_MODEL = CHAT_MODEL; // claude-sonnet-4-6

// ── Slop blocklist ────────────────────────────────────────────────────
// Phrases C3PAO assessors associate with template / AI-generated SSPs.
// If a draft contains any of these, we regenerate with an explicit
// "don't use" instruction. Kept short on purpose — false positives are
// expensive (user re-runs the tool); false negatives are cheap (critique
// catches them on the next pass).
const SLOP_PHRASES: readonly RegExp[] = [
  /\bthe organization shall\b/i,
  /\bbest[- ]?practices?\b/i,
  /\bindustry[- ]?standard\b/i,
  /\bas appropriate\b/i,
  /\bwhere applicable\b/i,
  /\bin accordance with industry\b/i,
  /\bleverag(es?|ing) cutting[- ]edge\b/i,
];

function detectSlopPhrases(text: string): string[] {
  const hits: string[] = [];
  for (const rx of SLOP_PHRASES) {
    const m = text.match(rx);
    if (m) hits.push(m[0]);
  }
  return hits;
}

// ── Types ─────────────────────────────────────────────────────────────

export type InterviewTurn = {
  q: string;
  a: string | null;
  asked_at: string;
  answered_at: string | null;
};

export type InterviewSessionRow = {
  id: string;
  assessment_id: string;
  organization_id: string;
  control_id: string;
  user_id: string;
  turns: InterviewTurn[];
  status: "active" | "drafted" | "abandoned";
  draft_narrative: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type CritiqueRow = {
  id: string;
  assessment_id: string;
  organization_id: string;
  control_id: string;
  narrative_hash: string;
  ready: boolean;
  weaknesses: string[];
  critiqued_at: string;
  critiqued_by_user_id: string;
};

export type ControlNarrativeContext = {
  orgName: string;
  orgNaics: string[];
  orgEntityType: string | null;
  orgScopedSystems: string | null;
  scopeNarrative: string | null;
  businessProfile: Record<string, unknown>;
  citation: ControlCitation | null;
  controlId: string;
  evidenceFilenames: string[];
  existingResponse: ControlResponseRow | null;
};

export type DraftResult = {
  draft: string;
  citedEvidence: string[];
  regeneratedForSlop: boolean;
};

export type CritiqueResult = {
  ready: boolean;
  weaknesses: string[];
};

// ── Context assembly ─────────────────────────────────────────────────

/**
 * Pulls every input Claude needs to draft a narrative for one control,
 * scoped to (assessment_id, control_id, organization_id). The caller must
 * have already verified the assessment belongs to the org.
 */
export async function gatherControlContext(args: {
  organizationId: string;
  assessmentId: string;
  controlId: string;
}): Promise<ControlNarrativeContext> {
  const { organizationId, assessmentId, controlId } = args;
  const sql = getSql();

  const [orgRows, scope, businessProfile, existingResponse, evidence] =
    await Promise.all([
      sql`
        SELECT name, naics_codes, entity_type, scoped_systems
        FROM organizations
        WHERE id = ${organizationId}
        LIMIT 1
      ` as unknown as Promise<
        Array<{
          name: string;
          naics_codes: string[];
          entity_type: string | null;
          scoped_systems: string | null;
        }>
      >,
      getScopeProfile(organizationId),
      getBusinessProfile(organizationId),
      getResponse(assessmentId, controlId),
      listEvidenceForControl(assessmentId, controlId),
    ]);

  const org = orgRows[0];
  if (!org) {
    throw new Error("Organization not found while gathering control context.");
  }

  return {
    orgName: org.name,
    orgNaics: org.naics_codes ?? [],
    orgEntityType: org.entity_type,
    orgScopedSystems: org.scoped_systems,
    scopeNarrative: scope.narrative,
    businessProfile: (businessProfile?.data ?? {}) as Record<string, unknown>,
    citation: (lookupCitation(controlId) as unknown) as ControlCitation | null,
    controlId,
    evidenceFilenames: evidence.map((e: EvidenceArtifactRow) => e.filename),
    existingResponse: existingResponse ?? null,
  };
}

/**
 * Does the org have *anything* concrete we can write about? If not, we
 * refuse to draft and surface a "let me ask a couple questions first"
 * affordance instead. The interview tool checks this before its first
 * question too.
 */
export function hasMinimumContext(ctx: ControlNarrativeContext): boolean {
  const businessFieldCount = Object.keys(ctx.businessProfile).filter((k) => {
    const v = ctx.businessProfile[k];
    return v !== null && v !== "" && v !== undefined;
  }).length;
  const haveScope =
    (ctx.scopeNarrative?.trim().length ?? 0) > 0 ||
    (ctx.orgScopedSystems?.trim().length ?? 0) > 0;
  const haveEvidence = ctx.evidenceFilenames.length > 0;
  // Need org name (always present) + at least one of: scope narrative,
  // some business profile fields filled in, or attached evidence.
  return haveScope || haveEvidence || businessFieldCount >= 3;
}

// ── Prompt builders ──────────────────────────────────────────────────

function summarizeContextForPrompt(ctx: ControlNarrativeContext): string {
  const parts: string[] = [];
  parts.push(`Organization: ${ctx.orgName}`);
  if (ctx.orgEntityType) parts.push(`Entity type: ${ctx.orgEntityType}`);
  if (ctx.orgNaics.length > 0)
    parts.push(`NAICS codes: ${ctx.orgNaics.join(", ")}`);
  if (ctx.orgScopedSystems)
    parts.push(`In-scope systems (from org settings):\n${ctx.orgScopedSystems}`);
  if (ctx.scopeNarrative)
    parts.push(`Boundary narrative (from scope profile):\n${ctx.scopeNarrative}`);

  // Only include business-profile fields that have non-empty values. This
  // keeps the prompt small and avoids feeding Claude blank scaffolding.
  const bp = ctx.businessProfile;
  const bpLines: string[] = [];
  for (const [k, v] of Object.entries(bp)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") {
      try {
        bpLines.push(`  - ${k}: ${JSON.stringify(v)}`);
      } catch {
        // skip un-serializable
      }
    } else {
      bpLines.push(`  - ${k}: ${String(v)}`);
    }
  }
  if (bpLines.length > 0) {
    parts.push(`Business profile facts:\n${bpLines.join("\n")}`);
  }

  if (ctx.citation) {
    parts.push(
      [
        `Control: ${ctx.citation.controlId} (${ctx.citation.cmmcPracticeId})`,
        `FAR: ${ctx.citation.farClause}`,
        `FAR text: ${ctx.citation.farText}`,
        `NIST: ${ctx.citation.nistControl}`,
        `NIST text: ${ctx.citation.nistText}`,
        `Assessment note: ${ctx.citation.cmmcAssessmentNote}`,
      ].join("\n"),
    );
  } else {
    parts.push(`Control: ${ctx.controlId} (no citation on file)`);
  }

  if (ctx.evidenceFilenames.length > 0) {
    parts.push(
      `Evidence files already attached to this control:\n${ctx.evidenceFilenames
        .map((f) => `  - ${f}`)
        .join("\n")}`,
    );
  } else {
    parts.push("Evidence files attached to this control: (none yet)");
  }

  if (ctx.existingResponse?.narrative) {
    parts.push(
      `Existing narrative (the user may want this rewritten):\n${ctx.existingResponse.narrative}`,
    );
  }

  return parts.join("\n\n");
}

const DRAFT_SYSTEM_PROMPT = `
You are an SSP (System Security Plan) ghostwriter for a small US defense
contractor pursuing CMMC Level 1 self-assessment. You will be given the
verbatim FAR + NIST control text and the company's own facts. Your job is
to produce ONE concise SSP narrative paragraph (4-8 sentences, 400-1200
characters) for that specific control.

Hard rules:
1. Write in first-person company voice using the company's actual name.
   Example: "Acme Defense limits CUI access to…" — NEVER "The
   organization shall…" or "The OSC will…".
2. Cite specifics from the provided facts. Name the actual systems
   (e.g. "Microsoft 365 Business Standard"), actual roles
   (e.g. "the IT lead and the owner"), and actual evidence filenames
   when they exist. If a fact isn't in the input, do NOT invent one.
3. Describe the IMPLEMENTATION (what they do, with what, who is
   accountable), not the requirement (what the rule says). Assessors
   read the rule from the control text; they read the narrative to
   verify implementation.
4. Forbidden phrases: "the organization shall", "best practices",
   "industry standard", "as appropriate", "where applicable",
   "leveraging cutting-edge", "in accordance with industry". These mark
   a draft as AI-generated to any experienced assessor.
5. If the input does not contain enough specifics to write a grounded
   narrative, reply with exactly: NEED_MORE_CONTEXT
   (and nothing else). The caller will run an interview to fill the gap.

Output: the narrative paragraph as plain text. No headers, no markdown,
no preamble, no "Here is the narrative:". Just the paragraph.
`.trim();

const INTERVIEW_SYSTEM_PROMPT = `
You are interviewing the owner of a small US defense contractor to gather
the facts needed to ghostwrite ONE SSP narrative paragraph for a single
CMMC Level 1 control. You will be given the control text and everything
the system already knows about the company.

Your job each turn:
- If you have enough specifics to write a grounded 4-8 sentence narrative
  in the company's own voice (named systems, named roles, concrete
  process), reply with exactly: READY_TO_DRAFT
- Otherwise, ask exactly ONE short, friendly, specific question that
  fills the biggest remaining gap. No multi-part questions. No
  open-ended "tell me about your security" prompts. Examples:
    • "Which MFA app do your admins use — Duo, Microsoft Authenticator,
       Okta, or YubiKey?"
    • "Who's responsible for adding and removing user accounts when
       someone joins or leaves — is that you, or another person?"
    • "What software do you use to keep an inventory of company
       laptops?"

Tone: conversational, plain English, no jargon. The owner is a
non-technical small-business person.

Output: either READY_TO_DRAFT or one question. Nothing else.
`.trim();

const CRITIQUE_SYSTEM_PROMPT = `
You are a CMMC C3PAO assessor reviewing one SSP narrative paragraph for
one CMMC Level 1 control. You will be given the control text and the
narrative. Output STRICT JSON with this exact shape:

{
  "ready": boolean,
  "weaknesses": string[]
}

- "ready" is true ONLY if all of these hold:
    1. The narrative describes a specific implementation (named systems,
       named roles, or concrete process) — not the requirement re-stated.
    2. The narrative is in first-person company voice, not template
       phrasing like "the organization shall".
    3. The narrative is between 200 and 2000 characters.
    4. The narrative does not contain forbidden marketing phrases like
       "best practices", "industry standard", "as appropriate".
- "weaknesses" is a short list (0-5 items) of concrete, actionable
  problems. Each item under 140 chars. Phrase them as fixes, not
  complaints. Example: "Name the MFA provider you actually use instead
  of saying 'multi-factor authentication is enforced'."

Output JSON ONLY. No markdown fences, no preamble.
`.trim();

// ── Anthropic helpers ────────────────────────────────────────────────

function stripJsonFence(s: string): string {
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return m ? m[1].trim() : s;
}

function extractTextBlock(content: Array<{ type: string }>): string | null {
  for (const block of content) {
    if (block.type === "text") {
      const tb = block as { type: "text"; text: string };
      return tb.text;
    }
  }
  return null;
}

/**
 * Produce a narrative draft for one control. Auto-regenerates once if the
 * first pass contains a slop phrase.
 */
export async function draftControlNarrative(args: {
  organizationId: string;
  ctx: ControlNarrativeContext;
  interviewAnswers?: InterviewTurn[];
}): Promise<DraftResult & { needsMoreContext: boolean }> {
  const { organizationId, ctx, interviewAnswers } = args;
  const client = getAnthropic();

  const contextBlock = summarizeContextForPrompt(ctx);
  const interviewBlock =
    interviewAnswers && interviewAnswers.length > 0
      ? `\n\nAdditional facts the owner just provided in interview:\n${interviewAnswers
          .filter((t) => t.a && t.a.trim().length > 0)
          .map((t) => `  Q: ${t.q}\n  A: ${t.a}`)
          .join("\n")}`
      : "";

  const userMessage = `${contextBlock}${interviewBlock}\n\nWrite the SSP narrative paragraph now.`;

  const firstResp = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 800,
    system: DRAFT_SYSTEM_PROMPT,
    metadata: metadataForOrg(organizationId, null),
    messages: [{ role: "user", content: userMessage }],
  });

  const firstText = (extractTextBlock(firstResp.content) ?? "").trim();
  if (firstText === "NEED_MORE_CONTEXT") {
    return {
      draft: "",
      citedEvidence: [],
      regeneratedForSlop: false,
      needsMoreContext: true,
    };
  }

  const firstHits = detectSlopPhrases(firstText);
  if (firstHits.length === 0) {
    return {
      draft: firstText,
      citedEvidence: ctx.evidenceFilenames.filter((f) =>
        firstText.toLowerCase().includes(f.toLowerCase()),
      ),
      regeneratedForSlop: false,
      needsMoreContext: false,
    };
  }

  // Slop hit — regenerate once with an explicit ban list.
  const banList = Array.from(new Set(firstHits)).join(", ");
  const retryResp = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 800,
    system: DRAFT_SYSTEM_PROMPT,
    metadata: metadataForOrg(organizationId, null),
    messages: [
      { role: "user", content: userMessage },
      { role: "assistant", content: firstText },
      {
        role: "user",
        content: `Rewrite. Your previous draft used these forbidden phrases: ${banList}. Replace them with concrete, company-specific language. Same length, same structure, no forbidden phrases.`,
      },
    ],
  });
  const retryText = (extractTextBlock(retryResp.content) ?? "").trim();
  return {
    draft: retryText.length > 0 ? retryText : firstText,
    citedEvidence: ctx.evidenceFilenames.filter((f) =>
      retryText.toLowerCase().includes(f.toLowerCase()),
    ),
    regeneratedForSlop: true,
    needsMoreContext: false,
  };
}

/**
 * One conversational interview turn. Returns either the next question or
 * a `ready: true` signal meaning the caller should now invoke
 * `draftControlNarrative` with the accumulated turns.
 */
export async function askNextInterviewQuestion(args: {
  organizationId: string;
  ctx: ControlNarrativeContext;
  turns: InterviewTurn[];
}): Promise<{ ready: boolean; question: string | null }> {
  const { organizationId, ctx, turns } = args;
  const client = getAnthropic();

  const contextBlock = summarizeContextForPrompt(ctx);
  const dialogue =
    turns.length === 0
      ? "(No questions asked yet — this is the first turn.)"
      : turns
          .map(
            (t, i) =>
              `Q${i + 1}: ${t.q}\nA${i + 1}: ${t.a ?? "(not yet answered)"}`,
          )
          .join("\n");

  const resp = await client.messages.create({
    model: INTERVIEW_MODEL,
    max_tokens: 200,
    system: INTERVIEW_SYSTEM_PROMPT,
    metadata: metadataForOrg(organizationId, null),
    messages: [
      {
        role: "user",
        content: `${contextBlock}\n\nInterview so far:\n${dialogue}\n\nWhat is the next question, or are you ready to draft?`,
      },
    ],
  });

  const text = (extractTextBlock(resp.content) ?? "").trim();
  if (text === "READY_TO_DRAFT" || /^READY_TO_DRAFT\b/.test(text)) {
    return { ready: true, question: null };
  }
  return { ready: false, question: text };
}

/**
 * Assessor-grade critique of a saved narrative. No score — just a
 * weaknesses list and a single ready boolean.
 */
export async function critiqueControlNarrative(args: {
  organizationId: string;
  ctx: ControlNarrativeContext;
  narrative: string;
}): Promise<CritiqueResult> {
  const { organizationId, ctx, narrative } = args;
  const client = getAnthropic();

  const contextBlock = summarizeContextForPrompt(ctx);

  const resp = await client.messages.create({
    model: DRAFT_MODEL,
    max_tokens: 500,
    system: CRITIQUE_SYSTEM_PROMPT,
    metadata: metadataForOrg(organizationId, null),
    messages: [
      {
        role: "user",
        content: `${contextBlock}\n\nNarrative under review:\n"""${narrative}"""\n\nReturn the JSON now.`,
      },
    ],
  });

  const raw = stripJsonFence((extractTextBlock(resp.content) ?? "").trim());
  let parsed: { ready?: unknown; weaknesses?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fail closed — if Claude wandered, flag the narrative as not-ready
    // and surface a generic weakness so the user knows to rerun.
    return {
      ready: false,
      weaknesses: ["Critique parser failed — re-run the critique tool."],
    };
  }
  const ready = parsed.ready === true;
  const rawWeak = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
  const weaknesses = rawWeak
    .filter((w): w is string => typeof w === "string")
    .slice(0, 5)
    .map((w) => w.slice(0, 280));
  return { ready, weaknesses };
}

// ── DB helpers ────────────────────────────────────────────────────────

/**
 * Loads the active interview session for this (org, assessment, control,
 * user) tuple, or creates a fresh row if none exists. Tenant-scoped: the
 * SELECT/INSERT both pin organization_id.
 */
export async function getOrCreateInterviewSession(args: {
  organizationId: string;
  assessmentId: string;
  controlId: string;
  userId: string;
}): Promise<InterviewSessionRow> {
  const { organizationId, assessmentId, controlId, userId } = args;
  const sql = getSql();

  const existing = (await sql`
    SELECT id, assessment_id, organization_id, control_id, user_id,
           turns, status, draft_narrative,
           created_at, updated_at, expires_at
    FROM narrative_interview_sessions
    WHERE organization_id = ${organizationId}
      AND assessment_id = ${assessmentId}
      AND control_id = ${controlId}
      AND user_id = ${userId}
      AND status = 'active'
      AND expires_at > NOW()
    ORDER BY updated_at DESC
    LIMIT 1
  `) as InterviewSessionRow[];
  if (existing[0]) return existing[0];

  const inserted = (await sql`
    INSERT INTO narrative_interview_sessions
      (assessment_id, organization_id, control_id, user_id)
    VALUES (${assessmentId}, ${organizationId}, ${controlId}, ${userId})
    RETURNING id, assessment_id, organization_id, control_id, user_id,
              turns, status, draft_narrative,
              created_at, updated_at, expires_at
  `) as InterviewSessionRow[];
  return inserted[0];
}

export async function appendInterviewTurn(args: {
  sessionId: string;
  organizationId: string;
  turn: InterviewTurn;
}): Promise<InterviewSessionRow> {
  const { sessionId, organizationId, turn } = args;
  const sql = getSql();
  const rows = (await sql`
    UPDATE narrative_interview_sessions
    SET turns = COALESCE(turns, '[]'::jsonb) || ${JSON.stringify([turn])}::jsonb,
        updated_at = NOW()
    WHERE id = ${sessionId}
      AND organization_id = ${organizationId}
    RETURNING id, assessment_id, organization_id, control_id, user_id,
              turns, status, draft_narrative,
              created_at, updated_at, expires_at
  `) as InterviewSessionRow[];
  if (!rows[0]) {
    throw new Error("Interview session not found or not in caller's org.");
  }
  return rows[0];
}

/**
 * Updates the most-recent turn in the session (the one whose answer is
 * still null) with the user's reply. If no unanswered turn exists, this
 * is a no-op and the caller should `appendInterviewTurn` instead.
 */
export async function answerLastInterviewTurn(args: {
  sessionId: string;
  organizationId: string;
  answer: string;
}): Promise<InterviewSessionRow> {
  const { sessionId, organizationId, answer } = args;
  const sql = getSql();

  // Read-modify-write — the turns array is the source of truth and we
  // need to find the rightmost unanswered turn.
  const current = (await sql`
    SELECT id, assessment_id, organization_id, control_id, user_id,
           turns, status, draft_narrative,
           created_at, updated_at, expires_at
    FROM narrative_interview_sessions
    WHERE id = ${sessionId}
      AND organization_id = ${organizationId}
    LIMIT 1
  `) as InterviewSessionRow[];
  const row = current[0];
  if (!row) throw new Error("Interview session not found.");

  const turns = [...row.turns];
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].a === null) {
      turns[i] = {
        ...turns[i],
        a: answer,
        answered_at: new Date().toISOString(),
      };
      break;
    }
  }

  const updated = (await sql`
    UPDATE narrative_interview_sessions
    SET turns = ${JSON.stringify(turns)}::jsonb,
        updated_at = NOW()
    WHERE id = ${sessionId}
      AND organization_id = ${organizationId}
    RETURNING id, assessment_id, organization_id, control_id, user_id,
              turns, status, draft_narrative,
              created_at, updated_at, expires_at
  `) as InterviewSessionRow[];
  return updated[0];
}

export async function markSessionDrafted(args: {
  sessionId: string;
  organizationId: string;
  draftNarrative: string;
}): Promise<void> {
  const { sessionId, organizationId, draftNarrative } = args;
  const sql = getSql();
  await sql`
    UPDATE narrative_interview_sessions
    SET status = 'drafted',
        draft_narrative = ${draftNarrative},
        updated_at = NOW()
    WHERE id = ${sessionId}
      AND organization_id = ${organizationId}
  `;
}

export function hashNarrative(narrative: string): string {
  return createHash("sha256")
    .update(narrative.trim().normalize("NFC"))
    .digest("hex");
}

export async function recordCritique(args: {
  organizationId: string;
  assessmentId: string;
  controlId: string;
  userId: string;
  narrative: string;
  ready: boolean;
  weaknesses: string[];
}): Promise<CritiqueRow> {
  const {
    organizationId,
    assessmentId,
    controlId,
    userId,
    narrative,
    ready,
    weaknesses,
  } = args;
  const sql = getSql();
  const narrativeHash = hashNarrative(narrative);
  const rows = (await sql`
    INSERT INTO narrative_critique_history
      (assessment_id, organization_id, control_id, narrative_hash, ready,
       weaknesses, critiqued_by_user_id)
    VALUES (${assessmentId}, ${organizationId}, ${controlId}, ${narrativeHash},
            ${ready}, ${JSON.stringify(weaknesses)}::jsonb, ${userId})
    RETURNING id, assessment_id, organization_id, control_id, narrative_hash,
              ready, weaknesses, critiqued_at, critiqued_by_user_id
  `) as CritiqueRow[];
  return rows[0];
}

export async function getLatestCritique(args: {
  organizationId: string;
  assessmentId: string;
  controlId: string;
}): Promise<CritiqueRow | null> {
  const { organizationId, assessmentId, controlId } = args;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, assessment_id, organization_id, control_id, narrative_hash,
           ready, weaknesses, critiqued_at, critiqued_by_user_id
    FROM narrative_critique_history
    WHERE organization_id = ${organizationId}
      AND assessment_id = ${assessmentId}
      AND control_id = ${controlId}
    ORDER BY critiqued_at DESC
    LIMIT 1
  `) as CritiqueRow[];
  return rows[0] ?? null;
}

/**
 * Upserts the narrative onto control_responses. Returns the row. Tenant
 * scoping is the caller's job (use getAssessmentForUser first).
 */
export async function saveNarrative(args: {
  assessmentId: string;
  controlId: string;
  narrative: string;
}): Promise<{ id: string; updated_at: string }> {
  const { assessmentId, controlId, narrative } = args;
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO control_responses (assessment_id, control_id, status, narrative)
    VALUES (${assessmentId}, ${controlId}, 'unanswered', ${narrative})
    ON CONFLICT (assessment_id, control_id) DO UPDATE
    SET narrative = EXCLUDED.narrative,
        updated_at = NOW()
    RETURNING id, updated_at
  `) as Array<{ id: string; updated_at: string }>;
  return rows[0];
}

/**
 * Move a control_response from `unanswered` to `partial` to reflect that
 * the interview copilot has gathered information for this control. Called
 * automatically the first time the user answers an interview question so
 * the overall practices progress bar advances on entry. Idempotent — only
 * touches rows currently in `unanswered`; leaves `yes` / `no` / `partial`
 * / `not_applicable` alone.
 */
export async function markResponseInProgress(args: {
  assessmentId: string;
  controlId: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO control_responses (assessment_id, control_id, status)
    VALUES (${args.assessmentId}, ${args.controlId}, 'partial')
    ON CONFLICT (assessment_id, control_id) DO UPDATE
    SET status = 'partial',
        updated_at = NOW()
    WHERE control_responses.status = 'unanswered'
  `;
}

/**
 * Snapshot of saved progress for one control, for use in the Charlie
 * system prompt. Lets the model see — on the very first turn after a
 * refresh — that the user has already answered N interview questions,
 * the narrative is/isn't drafted, evidence is/isn't attached, and how
 * each objective letter currently grades. This is what fixes the
 * "Charlie says 'hasn't been started' after refresh" failure mode: prompt
 * guidance alone is not enough, the model needs to literally see the
 * persisted state.
 */
export type ControlSavedState = {
  controlId: string;
  responseStatus: string | null;
  narrativeSavedChars: number;
  evidenceCount: number;
  interview: {
    sessionId: string | null;
    status: "active" | "drafted" | "abandoned" | "none";
    turnCount: number;
    answeredCount: number;
    lastQuestion: string | null;
    lastAnswer: string | null;
    pendingQuestion: string | null;
    draftReady: boolean;
  };
  objectives: Array<{ letter: string; status: string; reason: string | null }>;
};

export async function getControlSavedState(args: {
  organizationId: string;
  assessmentId: string;
  controlId: string;
  userId: string;
}): Promise<ControlSavedState> {
  const { organizationId, assessmentId, controlId, userId } = args;
  const sql = getSql();

  const [resp, sessRows, evRows, convRows] = await Promise.all([
    sql`
      SELECT status, narrative
      FROM control_responses
      WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
      LIMIT 1
    ` as unknown as Promise<Array<{ status: string; narrative: string | null }>>,
    sql`
      SELECT id, turns, status, draft_narrative
      FROM narrative_interview_sessions
      WHERE organization_id = ${organizationId}
        AND assessment_id = ${assessmentId}
        AND control_id = ${controlId}
        AND user_id = ${userId}
        AND expires_at > NOW()
      ORDER BY updated_at DESC
      LIMIT 1
    ` as unknown as Promise<Array<{
      id: string;
      turns: InterviewTurn[];
      status: "active" | "drafted" | "abandoned";
      draft_narrative: string | null;
    }>>,
    sql`
      SELECT COUNT(*)::int AS n
      FROM evidence_artifacts
      WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
    ` as unknown as Promise<Array<{ n: number }>>,
    sql`
      SELECT objective_verdicts
      FROM practice_conversations
      WHERE assessment_id = ${assessmentId} AND control_id = ${controlId}
      LIMIT 1
    ` as unknown as Promise<Array<{ objective_verdicts: Record<string, { status: string; reason?: string }> }>>,
  ]);

  const response = resp[0] ?? null;
  const session = sessRows[0] ?? null;
  const evidenceCount = evRows[0]?.n ?? 0;
  const verdicts = convRows[0]?.objective_verdicts ?? {};

  const turns: InterviewTurn[] = session?.turns ?? [];
  const answered = turns.filter((t) => t.a !== null);
  const lastAnswered = answered[answered.length - 1] ?? null;
  const pending = turns.find((t) => t.a === null) ?? null;

  return {
    controlId,
    responseStatus: response?.status ?? null,
    narrativeSavedChars: response?.narrative?.length ?? 0,
    evidenceCount,
    interview: {
      sessionId: session?.id ?? null,
      status: session?.status ?? "none",
      turnCount: turns.length,
      answeredCount: answered.length,
      lastQuestion: lastAnswered?.q ?? null,
      lastAnswer: lastAnswered?.a ?? null,
      pendingQuestion: pending?.q ?? null,
      draftReady: Boolean(session?.draft_narrative),
    },
    objectives: Object.entries(verdicts).map(([letter, v]) => ({
      letter,
      status: v.status,
      reason: v.reason ?? null,
    })),
  };
}

/**
 * Format a `ControlSavedState` as a Markdown block for the Charlie system
 * prompt. Empty state collapses to a short "Nothing saved yet" line.
 */
export function formatSavedStateBlock(state: ControlSavedState): string {
  const lines: string[] = [];
  lines.push(`## Saved progress for ${state.controlId}`);

  const nothing =
    state.responseStatus === null &&
    state.narrativeSavedChars === 0 &&
    state.evidenceCount === 0 &&
    state.interview.turnCount === 0 &&
    state.objectives.length === 0;
  if (nothing) {
    lines.push(
      `- Nothing saved yet for this practice. Open with \`interview_for_control_narrative\` (no \`answer\`) to start the conversation.`,
    );
    return lines.join("\n");
  }

  lines.push(`- Response status: ${state.responseStatus ?? "unanswered"}`);
  lines.push(
    `- Saved narrative: ${state.narrativeSavedChars > 0 ? `${state.narrativeSavedChars} chars on file` : "none"}`,
  );
  lines.push(`- Evidence attached: ${state.evidenceCount}`);

  if (state.interview.turnCount > 0) {
    lines.push(
      `- Interview session: ${state.interview.status}, ${state.interview.answeredCount}/${state.interview.turnCount} questions answered${state.interview.draftReady ? " (draft narrative pending save)" : ""}`,
    );
    if (state.interview.lastQuestion && state.interview.lastAnswer) {
      lines.push(`  - Last Q: ${truncateSaved(state.interview.lastQuestion, 240)}`);
      lines.push(`  - Last A: ${truncateSaved(state.interview.lastAnswer, 240)}`);
    }
    if (state.interview.pendingQuestion) {
      lines.push(
        `  - Outstanding question waiting on the user: ${truncateSaved(state.interview.pendingQuestion, 240)}`,
      );
    }
  } else {
    lines.push(`- Interview session: not started`);
  }

  if (state.objectives.length > 0) {
    const covered = state.objectives.filter((o) => o.status === "covered").length;
    const partial = state.objectives.filter((o) => o.status === "partial").length;
    const missing = state.objectives.filter((o) => o.status === "missing").length;
    lines.push(
      `- Objective verdicts: ${covered} covered, ${partial} partial, ${missing} missing`,
    );
  }

  lines.push("");
  lines.push(
    `**This means progress IS saved.** Do NOT tell the user "nothing has been started" if any of the numbers above are non-zero. Resume the interview by calling \`interview_for_control_narrative\` (with no \`answer\` to fetch the outstanding question, or with the user's reply to advance).`,
  );

  return lines.join("\n");
}

function truncateSaved(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
