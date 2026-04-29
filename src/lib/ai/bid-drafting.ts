import { CHAT_MODEL, getAnthropic } from "@/lib/anthropic";
import type { BidProfile } from "@/lib/bid-profile";

/**
 * AI helpers for the Bid-Ready Packet flow.
 *
 * Two responsibilities:
 *   1. Draft a capability statement / differentiators FROM the existing
 *      onboarding profile data, when the user clicks "Draft with AI" on the
 *      master Bid Profile form.
 *   2. Tailor an existing master profile for a specific solicitation, when
 *      the user pastes opportunity text on the per-opportunity tailor page.
 *
 * Both keep the user in control: the AI proposes text, the user edits it
 * before saving / generating. We never write to the master profile or the
 * generated packet without an explicit user submit.
 */

const SYSTEM_DRAFT = `You write capability statements for small U.S. defense-tech and federal-services companies.

You are direct, specific, and write at a contracting officer's reading level — no jargon-stuffing, no marketing fluff, no "leveraging synergies." Every sentence either describes a concrete capability the company has or a concrete outcome they deliver.

Format rules:
- 2 to 4 short paragraphs OR a tight intro paragraph followed by 4-6 bullets.
- 200-600 words total.
- Lead with what they do and who they serve. Anchor in NAICS or contract type when known.
- If the company has a CMMC L1 self-affirmation, mention it as a trust signal.
- Do not invent past performance, certifications, customer names, contract values, awards, headcount, or revenue. If a fact isn't in the input, leave it out.
- Use active voice. No emojis. No exclamation points.`;

const SYSTEM_TAILOR = `You tailor an existing capability statement for a specific federal solicitation.

You are given:
1. The vendor's master capability statement, differentiators, core competencies, NAICS, and set-asides.
2. The text of a specific opportunity (often a SAM.gov notice or scope of work).

Your job is to rewrite the capability statement and differentiators so they MAP to the language of the solicitation — using the agency's own terms when relevant — WITHOUT inventing capabilities the vendor does not have.

Hard rules:
- If the vendor cannot demonstrate a capability the solicitation asks for, do NOT pretend they can. Lead with the capabilities they DO have that overlap.
- Do not invent contract numbers, customer names, certifications, or past performance.
- Stay 200-600 words for the capability statement, 80-200 words for differentiators.
- Use active voice. No emojis. No exclamation points.`;

/**
 * Draft a capability statement from the vendor's onboarding profile + org data.
 * Returns plain text the form will paste into the textarea.
 */
export async function draftCapabilityStatement(input: {
  orgName: string;
  entityType: string | null;
  naicsCodes: string[];
  scopedSystems: string | null;
  businessProfileData: Record<string, unknown>;
  current: BidProfile;
}): Promise<string> {
  const client = getAnthropic();

  const profileFacts = formatFacts(input.businessProfileData);
  const userPrompt = `Company: ${input.orgName}${input.entityType ? ` (${input.entityType})` : ""}
NAICS: ${input.naicsCodes.length > 0 ? input.naicsCodes.join(", ") : "(none on file)"}
Assessment scope: ${input.scopedSystems ?? "(not provided)"}

Onboarding profile facts:
${profileFacts || "(no profile data captured yet)"}

Existing capability statement (may be empty or rough):
${input.current.capability_statement || "(empty)"}

Existing core competencies:
${input.current.core_competencies || "(empty)"}

Existing differentiators:
${input.current.differentiators || "(empty)"}

Set-asides claimed: ${input.current.set_asides.length > 0 ? input.current.set_asides.join(", ") : "none"}

Write a capability statement following the format rules. Return ONLY the statement text — no preamble, no headers, no explanation.`;

  const response = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1500,
    system: SYSTEM_DRAFT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractText(response).trim();
}

/**
 * Draft differentiators (3-6 bullets) from existing profile + onboarding data.
 */
export async function draftDifferentiators(input: {
  orgName: string;
  current: BidProfile;
  businessProfileData: Record<string, unknown>;
}): Promise<string> {
  const client = getAnthropic();

  const profileFacts = formatFacts(input.businessProfileData);
  const userPrompt = `Company: ${input.orgName}

Onboarding profile facts:
${profileFacts || "(no profile data captured yet)"}

Existing capability statement:
${input.current.capability_statement || "(empty)"}

Existing differentiators (rewrite these — don't echo unless they're good):
${input.current.differentiators || "(empty)"}

Write 4-6 short, concrete differentiator bullets — one per line, no leading dash or bullet character. Each bullet must reference an actual capability or attribute the company has (per the facts). Do NOT invent customer names, certifications, awards, or revenue. Return ONLY the bullets, one per line, no preamble.`;

  const response = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 600,
    system: SYSTEM_DRAFT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractText(response).trim();
}

export type TailorResult = {
  capability_statement: string;
  differentiators: string;
};

/**
 * Tailor a master profile for a specific solicitation. The result is a
 * proposed override the user can edit before generating the packet. We do
 * NOT mutate the master profile.
 */
export async function tailorForOpportunity(input: {
  orgName: string;
  profile: BidProfile;
  naicsCodes: string[];
  opportunityText: string;
}): Promise<TailorResult> {
  const client = getAnthropic();

  const TOOL = {
    name: "submit_tailored_copy",
    description: "Submit the tailored capability statement and differentiators.",
    input_schema: {
      type: "object" as const,
      properties: {
        capability_statement: {
          type: "string",
          description:
            "Tailored capability statement. 200-600 words. Plain text with paragraph breaks (\\n\\n).",
        },
        differentiators: {
          type: "string",
          description:
            "Tailored differentiators. 80-200 words. Plain text with paragraph breaks OR bullets (one per line, no leading bullet character).",
        },
      },
      required: ["capability_statement", "differentiators"],
    },
  };

  const userPrompt = `Vendor: ${input.orgName}
Vendor NAICS: ${input.naicsCodes.length > 0 ? input.naicsCodes.join(", ") : "(none)"}
Vendor set-asides: ${input.profile.set_asides.length > 0 ? input.profile.set_asides.join(", ") : "none"}

Master capability statement:
${input.profile.capability_statement || "(empty — write from scratch using the core competencies below)"}

Core competencies:
${input.profile.core_competencies || "(none on file)"}

Master differentiators:
${input.profile.differentiators || "(none on file)"}

---

OPPORTUNITY TEXT (the solicitation, scope of work, or SAM.gov notice):

${input.opportunityText}

---

Tailor the capability statement and differentiators to map to the language of the opportunity. Use the agency's own terms when they overlap with the vendor's actual capabilities. Do NOT invent capabilities. Call submit_tailored_copy exactly once.`;

  const response = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2500,
    system: SYSTEM_TAILOR,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_tailored_copy" },
    messages: [{ role: "user", content: userPrompt }],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "submit_tailored_copy") {
      const args = block.input as Record<string, unknown>;
      return {
        capability_statement:
          typeof args.capability_statement === "string"
            ? args.capability_statement
            : "",
        differentiators:
          typeof args.differentiators === "string" ? args.differentiators : "",
      };
    }
  }

  throw new Error("AI did not return a tailored result");
}

function extractText(response: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function formatFacts(data: Record<string, unknown>): string {
  if (!data || typeof data !== "object") return "";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "bid_ready") continue; // skip our own namespace
    if (value == null) continue;
    if (typeof value === "string") {
      if (value.trim()) lines.push(`- ${humanKey(key)}: ${value.trim()}`);
    } else if (Array.isArray(value)) {
      const items = value.filter((v) => v != null && String(v).trim());
      if (items.length > 0)
        lines.push(`- ${humanKey(key)}: ${items.join(", ")}`);
    } else if (typeof value === "object") {
      lines.push(`- ${humanKey(key)}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`- ${humanKey(key)}: ${String(value)}`);
    }
  }
  return lines.join("\n");
}

function humanKey(key: string): string {
  return key.replace(/_/g, " ");
}
