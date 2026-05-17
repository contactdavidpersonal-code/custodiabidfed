/**
 * Per-page context packs for Charlie.
 *
 * Each route in the platform gets a deterministic "page contract" that tells
 * Charlie:
 *   - what page the user is on (human label)
 *   - what they're trying to accomplish on this page (one-sentence goal)
 *   - which tools to PREFER and which to AVOID here
 *   - the structured sections / required order, when applicable
 *   - the specific FAR 52.204-21 / DoD scoping rules in play
 *
 * This is the single source of truth for "where am I, what's expected".
 * /api/chat and /api/onboard pipe the user's pathname through `buildPageContextBlock`
 * to produce the volatile half of the system context (the stable half — persona,
 * tools, long-term memory — is cached separately).
 *
 * Design principles:
 *   - Page packs are TEXT. They are appended to the system prompt as a single
 *     "## Current page" block. We do NOT enforce tool whitelists in code — the
 *     1-add-per-turn cap in stream.ts is the safety belt; the page pack is the
 *     guidance layer.
 *   - Packs are deterministic and cheap. No DB calls inside this module.
 *     Anything dynamic (section counts, current step) is passed in by the caller.
 *   - When in doubt, fall back to the generic pack. A vague pack is better than
 *     a wrong one.
 */

import { getPracticeSpec } from "@/lib/cmmc/practice-spec";

export type PageContextInput = {
  /** Full pathname like "/assessments/abc/scope". */
  route?: string;
  assessmentId?: string;
  controlId?: string;
};

/** Build the "## Current page" markdown block for the system context. */
export function buildPageContextBlock(input: PageContextInput): string {
  const route = (input.route ?? "").trim();
  if (!route) return "";

  // Route through the most-specific pack first.
  const pack = matchPack(route, input);
  const lines: string[] = [];
  lines.push(`## Current page — ${pack.label}`);
  lines.push(`Route: \`${route}\``);
  lines.push(`Goal here: ${pack.goal}`);
  if (pack.preferredTools.length > 0) {
    lines.push(`Preferred tools on this page: ${pack.preferredTools.map((t) => `\`${t}\``).join(", ")}`);
  }
  if (pack.avoidTools.length > 0) {
    lines.push(`Do NOT use here: ${pack.avoidTools.map((t) => `\`${t}\``).join(", ")} (they belong to other pages)`);
  }
  if (pack.body) {
    lines.push("");
    lines.push(pack.body);
  }
  return lines.join("\n");
}

type Pack = {
  label: string;
  goal: string;
  preferredTools: string[];
  avoidTools: string[];
  body: string;
};

function matchPack(route: string, input: PageContextInput): Pack {
  // --- Assessment wizard pages -------------------------------------------
  if (route.match(/^\/assessments\/[^/]+\/profile/)) return PACK_PROFILE;
  if (route.match(/^\/assessments\/[^/]+\/registration/)) return PACK_REGISTRATION;
  if (route.match(/^\/assessments\/[^/]+\/scope/)) return PACK_SCOPE;
  if (route.match(/^\/assessments\/[^/]+\/boundary/)) return PACK_BOUNDARY;
  if (route.match(/^\/assessments\/[^/]+\/statement/)) return PACK_STATEMENT;
  if (route.match(/^\/assessments\/[^/]+\/controls\/[^/]+/)) {
    return buildControlsDetailPack(input.controlId);
  }
  if (route.match(/^\/assessments\/[^/]+\/controls/)) return PACK_CONTROLS_LIST;
  if (route.match(/^\/assessments\/[^/]+\/sign/)) return PACK_SIGN;
  if (route.match(/^\/assessments\/[^/]+\/affirmation/)) return PACK_AFFIRMATION;
  if (route.match(/^\/assessments\/[^/]+\/bid-packet/)) return PACK_BID_PACKET;
  if (route.match(/^\/assessments\/[^/]+\/deliverables/)) return PACK_DELIVERABLES;
  if (route.match(/^\/assessments\/[^/]+\/ssp/)) return PACK_SSP;
  if (route.match(/^\/assessments\/[^/]+\/material-change/)) return PACK_MATERIAL_CHANGE;
  if (route.match(/^\/assessments\/[^/]+\/exceptions/)) return PACK_EXCEPTIONS;
  if (route.match(/^\/assessments\/[^/]+\/verified/)) return PACK_VERIFIED;
  if (route.match(/^\/assessments\/[^/]+$/)) return PACK_ASSESSMENT_HOME;

  // --- Outside the wizard ------------------------------------------------
  if (route === "/onboard" || route.startsWith("/onboard")) return PACK_ONBOARD;
  if (route.match(/^\/regulations\/[^/]+/)) return buildRegulationsDocPack(route);
  if (route === "/regulations") return PACK_REGULATIONS_HUB;
  if (route.match(/^\/opportunities\/[^/]+/)) return PACK_OPPORTUNITY_DETAIL;
  if (route === "/opportunities" || route.startsWith("/opportunities")) return PACK_OPPORTUNITIES;
  if (route === "/profile" || route.startsWith("/profile")) return PACK_USER_PROFILE;
  if (route === "/trust" || route.startsWith("/trust")) return PACK_TRUST;
  if (route.startsWith("/verified/")) return PACK_VERIFIED_PUBLIC;

  return PACK_GENERIC;
}

// =========================================================================
// Wizard packs
// =========================================================================

const PACK_PROFILE: Pack = {
  label: "Business profile (Step 1 of 8)",
  goal:
    "Capture the legal-name, address, business type, NAICS codes, and primary contact for the org so downstream artifacts (SSP, affirmation, SPRS export) populate correctly.",
  preferredTools: ["read_assessment_state", "update_business_profile", "update_organization_fields"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset", "set_affirming_official"],
  body: `What to do here:
- If the user gives you facts (legal name, EIN, address, NAICS, etc.), call \`update_business_profile\` with just the fields they confirmed. One field group per call. Do NOT batch unrelated guesses.
- Ask ONE clarifying question at a time. Plain English.
- If a field is unclear (e.g. "what's a NAICS code?"), explain briefly and offer a concrete example tied to what they told you they do.
- When the profile section is complete, summarize what's saved and direct them to the next step (Federal registration).`,
};

const PACK_REGISTRATION: Pack = {
  label: "Federal registration (Step 2 of 8)",
  goal:
    "Record the org's SAM.gov UEI, CAGE code, and confirm NAICS codes. These three values are required for the affirming-official record and the SPRS submission.",
  preferredTools: ["read_assessment_state", "update_organization_fields"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: `What to do here:
- UEI is 12 characters, alphanumeric, no spaces (e.g. "XE1VM65Q4AC6"). If they paste something that doesn't match the format, ask them to double-check on SAM.gov.
- CAGE is 5 characters, alphanumeric.
- NAICS codes are 6 digits. If they don't know theirs, ask what their business actually does and suggest the most likely code(s) — do NOT guess silently.
- If the user says they haven't registered on SAM.gov yet, tell them they need to before they can submit to SPRS, and link them to /sam-guide.`,
};

const PACK_SCOPE: Pack = {
  label: "Scope inventory (Step 3 of 8)",
  goal:
    "Build the complete list of people, technology, facilities, ESPs (External Service Providers), and specialized assets that handle FCI. This is the boundary the assessor will use.",
  preferredTools: [
    "read_scope_inventory_state",
    "add_scope_item",
    "add_esp",
    "add_specialized_asset",
  ],
  avoidTools: [
    "add_fci_flow",
    "add_out_of_scope_item",
    "set_affirming_official",
    "generate_evidence_artifact",
  ],
  body: `**This page is gated by the scope-inventory discipline rules in your system prompt.** Read those again before each add call.

**READ THE USER'S WORDS FIRST. Do not call any add tool unless the user's most recent message EXPLICITLY named one or more concrete items to add (a person's name, a device, a SaaS product, an address, etc.). If the user said "what's next?", "ok", "stop", "wait", or asked a question — RESPOND WITH TEXT ONLY. Being on the scope page does NOT mean you should add things; it means you should help the user build the list when they tell you what's on it.**

The five sections, IN ORDER:
1. **People** — humans who access FCI (employees, contractors, owners). Use \`add_scope_item\` with \`kind: "people"\`.
2. **Technology** — laptops, phones, servers, on-prem network gear, SaaS accounts the org owns and operates (e.g. their own Microsoft 365 tenant). Use \`add_scope_item\` with \`kind: "technology"\`.
3. **Facility** — physical locations where FCI is processed or stored (home office, leased office, datacenter rack). Use \`add_scope_item\` with \`kind: "facility"\`.
4. **External Service Providers (ESPs)** — vendor SaaS that PROCESSES or STORES FCI on the org's behalf (e.g. Vercel hosting, Neon DB, AWS KMS, Microsoft 365 if they're a customer not a tenant admin). Use \`add_esp\`, NOT \`add_scope_item\`.
5. **Specialized Assets** — IoT, IIoT, OT, GFE (government-furnished equipment), restricted information systems, test equipment. Use \`add_specialized_asset\`.

Decision rule when the user names a SaaS:
- If they ADMINISTER the tenant (full admin, billing relationship is theirs) → Technology.
- If they USE someone else's tenant or pay a vendor to host data → ESP.
- If it's Microsoft 365 / Google Workspace and they're the admin → BOTH count; record the tenant as Technology and the underlying provider as an ESP.

Multi-add is fine and encouraged when the user lists multiple items in one message. If they say "add me, my wife as contractor, the laptop, the Pixel 9a, and our home office" — that is FIVE adds in this turn. Do them all. The server has an abuse cap at 8 per message; nothing else stops you.

Hard rules:
- Always \`read_scope_inventory_state\` before adding so you know what already exists.
- Case-insensitive duplicate labels are rejected by the server (the row returns \`already_existed: true\`). If you see that flag, tell the user the item was already there and ASK what they want to do — do not retry the same add.
- If the user wants to EDIT or REMOVE a row, they do it on the page via the Edit/Delete buttons — you do not have an update tool yet. Tell them that.
- After a batch of adds, ALWAYS reply with text: summarize what was just added and ask what's next.

When a section is complete: call \`read_scope_inventory_state\` and recite back the rows in that section ("Here's what we have for People: …. Anything missing or wrong?"). Wait for confirmation, then move to the next section.

If you ever get stuck or confused, tell the user they can type \`/reset\` to start a fresh conversation.`,
};

const PACK_BOUNDARY: Pack = {
  label: "FCI boundary (FCI data flow + out-of-scope declarations)",
  goal:
    "Document how FCI enters the org, where it lives, where it leaves, and explicitly declare anything that does NOT touch FCI as out-of-scope. This produces the boundary diagram for the SSP.",
  preferredTools: ["read_boundary_state", "add_fci_flow", "add_out_of_scope_item"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: `Workflow:
1. Read the existing scope inventory and boundary state once at the start of this page.
2. Walk the user through FCI life-cycle: receive → store → process → transmit → destroy.
3. For each step, capture a \`add_fci_flow\` call describing source, destination, and medium (email, SFTP, portal, paper).
4. Once flows are captured, walk through what the user thinks is out-of-scope (personal devices not used for FCI, marketing SaaS, accounting software that never sees FCI) and record each with \`add_out_of_scope_item\`. Out-of-scope declarations matter — they're the assessor's evidence that you considered the asset and explicitly excluded it.

The DoD CMMC Scoping Guide — Level 1 (/regulations/scoping-guide-level-1) is the authoritative source for these definitions. Reference it when the user asks "does X count?"`,
};

const PACK_STATEMENT: Pack = {
  label: "Scoping statement",
  goal: "Generate / review the written scoping statement that goes into the SSP and the SPRS narrative.",
  preferredTools: ["read_scope_inventory_state", "read_boundary_state", "suggest_narrative"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset", "add_fci_flow"],
  body: `The scoping statement is a 1–2 paragraph plain-English summary describing the boundary. Pull from the scope inventory and the FCI flows already captured. Do NOT add new scope items here — if the user mentions something not yet in the inventory, send them back to /scope to add it first.`,
};

const PACK_CONTROLS_LIST: Pack = {
  label: "15 safeguarding practices (Step 4 of 8)",
  goal:
    "Help the user navigate the 15 FAR 52.204-21(b)(1)(i)–(xv) practices. The detail work (gathering objectives and evidence) happens on each individual practice page.",
  preferredTools: ["read_assessment_state", "check_readiness", "cite_regulation"],
  avoidTools: [
    "add_scope_item",
    "add_esp",
    "add_specialized_asset",
    "add_fci_flow",
    "add_out_of_scope_item",
  ],
  body: `What to do here:
- If the user asks "where should I start?", recommend AC.L1-b.1.i (limit system access to authorized users) — it's the most foundational and almost every other practice references it.
- If they ask "how am I doing?", call \`check_readiness\` and summarize MET / NOT MET / NOT APPLICABLE counts.
- Do NOT generate evidence here — that happens on the per-practice page so the artifact lands in the right slot. If they want to work a practice, ask which one and tell them to click into it.
- Authoritative source for the practice list: FAR 52.204-21 (/regulations + acquisition.gov link).
- Authoritative source for the assessor objectives: CMMC Assessment Guide — Level 1 (/regulations/assessment-guide-level-1).`,
};

function buildControlsDetailPack(controlId?: string): Pack {
  const spec = controlId ? getPracticeSpec(controlId) : null;
  if (!spec) {
    return {
      label: `Practice detail page${controlId ? ` (${controlId})` : ""}`,
      goal: "Run the interview-style narrative copilot so this practice gets a real first-person SSP paragraph, then capture evidence.",
      preferredTools: [
        "read_assessment_state",
        "interview_for_control_narrative",
        "draft_control_narrative",
        "save_control_narrative",
        "critique_control_narrative",
        "describe_evidence",
        "generate_evidence_artifact",
        "cite_regulation",
      ],
      avoidTools: [
        "add_scope_item",
        "add_esp",
        "add_specialized_asset",
        "add_fci_flow",
        "add_out_of_scope_item",
        "suggest_narrative",
      ],
      body: `**You are on a per-practice page. SCOPE INVENTORY TOOLS ARE OFF-LIMITS HERE — do not call \`add_scope_item\`, \`add_esp\`, \`add_specialized_asset\`, \`add_fci_flow\`, or \`add_out_of_scope_item\` on this page under any circumstance. Those belong on /scope and /boundary. If the user wants to add a person, device, or vendor, tell them to go to the Scope tab.**

Opening behavior: if the user has no narrative yet, OPEN by calling \`interview_for_control_narrative\` with this \`control_id\` and no \`answer\` — that returns the first conversational question. Then for every subsequent user reply, call \`interview_for_control_narrative\` again, passing the user's words verbatim as \`answer\`. When the tool returns a final \`draft\`, show it to the user, ask if they want any tweaks, and on approval call \`save_control_narrative\`. After save you may call \`critique_control_narrative\` to surface weaknesses before they sign.

Generate evidence artifacts via \`generate_evidence_artifact\` — never paste rosters or procedures into chat. Plain English, one question at a time.`,
    };
  }

  // Rich practice-spec body — this is the existing /controls/[id] behavior
  // preserved verbatim, but now lives in the central page-context module.
  const objectives = spec.objectives.map((o) => `  [${o.letter}] ${o.text}`).join("\n");
  const slots = spec.evidenceSlots
    .map((s) => {
      const dests = s.destinations
        .map((d) => {
          if (d.type === "generate") return `generate→${d.filename}`;
          if (d.type === "connect") return `connect→${d.providers.join("|")}`;
          return "upload";
        })
        .join(", ");
      return `  - key='${s.key}' — ${s.label} (${s.required ? "required" : "optional"}; satisfies [${s.satisfies.join(", ")}]; rails: ${dests}): ${s.hint}`;
    })
    .join("\n");

  return {
    label: `Practice ${spec.controlId} — ${spec.shortName} (interview + evidence)`,
    goal: "Run the conversational narrative copilot so this practice gets a real first-person SSP paragraph, then fill every NIST 800-171A objective and produce evidence artifacts.",
    preferredTools: [
      "read_assessment_state",
      "interview_for_control_narrative",
      "draft_control_narrative",
      "save_control_narrative",
      "critique_control_narrative",
      "describe_evidence",
      "generate_evidence_artifact",
      "cite_regulation",
    ],
    avoidTools: [
      "add_scope_item",
      "add_esp",
      "add_specialized_asset",
      "add_fci_flow",
      "add_out_of_scope_item",
      "suggest_narrative",
    ],
    body: `**HARD ANCHOR — READ FIRST.** The user is on the page for practice **\`${spec.controlId}\`** RIGHT NOW. Every question, tool call, and narrative you produce on this turn MUST be for \`${spec.controlId}\`. Rules:

1. **Do NOT call \`navigate_user_to\` to this same practice** — you are already here. The platform will reject self-navigation.
2. **Do NOT claim to have saved a narrative you didn't actually save THIS turn.** Only mention saves that appear in the "Saved progress" block below OR that came back from a tool call in your current response. If the saved-progress block says "Nothing saved yet", you have NOT saved anything yet — do not say otherwise.
3. **Do NOT re-introduce \`${spec.controlId}\` if you already introduced it earlier in this chat.** Scan the recent assistant turns above before opening. If you already asked the opening question, your job now is to PROCESS the user's last answer, not re-greet them.
4. **If the user just gave an answer to your last question, your IMMEDIATE next tool call MUST be \`interview_for_control_narrative\` with \`control_id="${spec.controlId}"\` and \`answer\`=<the user's exact words>.** Do NOT skip to navigate, do NOT switch practices, do NOT re-ask the same question.
5. **The "Outstanding question waiting on the user" line in the saved-progress block below is the question YOU last asked. Don't ask it again — wait for the answer or advance the interview with whatever the user just said.**

**You are on a per-practice page. SCOPE INVENTORY TOOLS ARE OFF-LIMITS HERE — do not call \`add_scope_item\`, \`add_esp\`, \`add_specialized_asset\`, \`add_fci_flow\`, or \`add_out_of_scope_item\` on this page under any circumstance. Those belong on /scope and /boundary. If the user wants to add a person, device, or vendor, tell them to go to the Scope tab and stop.**

### Verbatim control statement (FAR 52.204-21 / NIST SP 800-171 §${spec.controlId})
"${spec.statement}"

### NIST 800-171A objectives the assessor will check:
${objectives}

### Evidence slots an assessor accepts:
${slots}

### Opening behavior — narrative-first interview

**On the FIRST turn after the user lands on this page (or any greeting like "hi", "what's next", "ok"):** call \`read_assessment_state\` once, then call \`interview_for_control_narrative\` with this practice's \`control_id\` and NO \`answer\` field. That returns the first conversational question from the interview copilot. Relay that question to the user verbatim (or in your own slightly warmer phrasing) — do NOT call any other mutator tool on this opening turn.

**On every subsequent user reply during the interview:** call \`interview_for_control_narrative\` again, passing the user's most recent message verbatim as \`answer\`. The tool returns either the next question OR a finished \`draft\` narrative. When you receive a \`draft\`:
  1. Show the draft to the user in a single block.
  2. Ask if they want any tweaks.
  3. On user approval ("looks good", "save it", "yes") call \`save_control_narrative\` with the exact draft text and this \`control_id\`.
  4. After saving, you MAY call \`critique_control_narrative\` to flag any remaining weaknesses before they sign. Surface the weakness list as a short bulleted summary.

**Quick-draft path (when the user says "just write it for me" / "skip the interview" / "draft something"):** call \`draft_control_narrative\` directly. Show the draft, confirm, then \`save_control_narrative\`.

**Bulk path:** if the user says "do all of them" / "draft every practice", point them at \`bulk_draft_remaining_narratives\` — but recommend the interview for at least 1-2 controls first so the tone calibrates.

### Objectives + evidence
- ONE question at a time. Plain English. No jargon without defining it.
- The user is not a security expert. Assume zero prior knowledge.
- The interview tool drives the objective coverage — you do not need to ask objective-by-objective questions yourself unless the interview is finished and an objective is still uncovered.
- The middle pane has an Evidence section listing every slot above. As the user gives you facts, FILL THE SLOTS by calling \`generate_evidence_artifact\` — do NOT paste roster tables, procedures, or service-account lists into chat. Pass the slot's \`key\` exactly as listed above.
- After a \`generate_evidence_artifact\` succeeds, give a 1-2 sentence chat summary like: "I dropped an Authorized Users Roster into your evidence — listed you as the sole user on Windows 11 + Pixel 9a. Replace it if anything's wrong."
- For evidence that requires a screenshot or live system export (e.g. enforcement_proof), do NOT generate — instead ask the user to either upload one OR connect Microsoft 365 / Google Workspace from /assessments/connections so Custodia can auto-collect it.
- NEVER mark the practice MET on your own — the platform handles that. You gather facts, produce artifacts, save narratives.
- Keep replies short — 2-5 sentences. The middle pane is doing the visual tracking.

Authoritative sources:
- The regulatory text: \`cite_regulation\` tool + /regulations (FAR 52.204-21).
- The assessor methodology: /regulations/assessment-guide-level-1 (DoD CMMC Assessment Guide L1 v2.13).`,
  };
}

const PACK_SIGN: Pack = {
  label: "Sign & affirm (Step 5 of 8)",
  goal: "Record the affirming official's name, title, email, and assent before the SPRS submission.",
  preferredTools: ["read_assessment_state", "check_readiness", "set_affirming_official"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset", "generate_evidence_artifact"],
  body: `What to do here:
- The affirming official must be a "senior official of the organization" per 32 CFR § 170.22. For a sole-prop or small LLC this is usually the owner.
- Call \`check_readiness\` first — if any practice is NOT MET, surface that and ask if they want to mark exceptions or fix it before signing.
- Once signed, the next step is the SPRS submission (handled outside the wizard but the affirmation record is generated here).
- Authoritative source: 32 CFR Part 170 (/regulations).`,
};

const PACK_AFFIRMATION: Pack = {
  label: "Affirmation summary",
  goal: "Show the user the affirmation record that will be submitted to SPRS.",
  preferredTools: ["read_assessment_state"],
  avoidTools: ["set_affirming_official", "add_scope_item", "add_esp", "add_specialized_asset"],
  body: "Read-only summary. If the user wants to change anything, send them back to /sign.",
};

const PACK_BID_PACKET: Pack = {
  label: "Bid packet (Step 6 of 8)",
  goal: "Assemble the bid-ready packet (SPRS confirmation, scoping statement, SSP excerpts) the user can drop into a prime's request.",
  preferredTools: ["read_assessment_state", "suggest_narrative"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: "Help the user understand what's in the packet and how to use it when a prime asks for proof of CMMC L1 status.",
};

const PACK_DELIVERABLES: Pack = {
  label: "Deliverables (Step 7 of 8)",
  goal: "Final downloadable artifacts (SSP, scoping statement, affirmation record).",
  preferredTools: ["read_assessment_state"],
  avoidTools: [],
  body: "If anything looks wrong, send them back to the step that owns that data.",
};

const PACK_SSP: Pack = {
  label: "System Security Plan (SSP)",
  goal: "Help the user generate or review the SSP — the document that ties scope + practices + evidence into one assessor-ready package.",
  preferredTools: ["read_assessment_state", "suggest_narrative"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: "Authoritative source for SSP content expectations: NIST SP 800-171A and the DoD CMMC Assessment Guide L1 (/regulations/assessment-guide-level-1).",
};

const PACK_MATERIAL_CHANGE: Pack = {
  label: "Material change record",
  goal: "Record a material change to the org's environment that triggers a re-affirmation per 32 CFR § 170.22.",
  preferredTools: ["read_assessment_state"],
  avoidTools: [],
  body: "Material changes include: new ESP that processes FCI, change of affirming official, change of business name, or expansion of the in-scope environment.",
};

const PACK_EXCEPTIONS: Pack = {
  label: "Exceptions",
  goal: "Document any practice marked NOT MET with the user's plan + timeline to remediate.",
  preferredTools: ["read_assessment_state", "propose_milestone"],
  avoidTools: [],
  body: "CMMC L1 requires all 15 practices MET to affirm. Exceptions here are for planning — they don't satisfy the affirmation. If the user wants to ship anyway, surface that clearly.",
};

const PACK_VERIFIED: Pack = {
  label: "Verified trust page (preview)",
  goal: "Preview the public /verified/[slug] page that will go live once the user signs and submits.",
  preferredTools: ["read_assessment_state"],
  avoidTools: [],
  body: "Read-only preview. The page goes live automatically once affirmation is signed.",
};

const PACK_ASSESSMENT_HOME: Pack = {
  label: "Assessment home",
  goal: "Show the user where they are in the 8-step wizard and what's next.",
  preferredTools: ["read_assessment_state", "check_readiness"],
  avoidTools: [],
  body: "Steps: 1 Profile → 2 Registration → 3 Scope → 4 Practices → 5 Sign → 6 Bid packet → 7 Deliverables → 8 Find/submit bids. Locked steps unlock as prior ones complete.",
};

// =========================================================================
// Outside-wizard packs
// =========================================================================

const PACK_ONBOARD: Pack = {
  label: "Onboarding",
  goal: "Get the user from zero to a workspace with the right context for their business.",
  preferredTools: ["update_business_profile", "update_organization_fields"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset", "set_affirming_official"],
  body: "Onboarding is conversational — one question at a time. Capture business profile via \`update_business_profile\` and federal IDs via \`update_organization_fields\`. Do NOT start building the scope inventory yet; that happens in the assessment wizard.",
};

const PACK_REGULATIONS_HUB: Pack = {
  label: "Regulations hub",
  goal: "Help the user find the authoritative source for any CMMC / SPRS / FAR / DFARS rule.",
  preferredTools: ["cite_regulation"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: `This page lists every primary source for CMMC Level 1 with direct links:
- 32 CFR Part 170 (the CMMC Program rule)
- 48 CFR DFARS 252.204-7021 (the contract clause)
- FAR 52.204-21 (the 15 safeguarding requirements)
- DFARS 252.204-7012, -7019, -7020 (Level 2 / CUI — referenced for context, not required for L1)
- DoD CMMC Scoping Guide — Level 1 (/regulations/scoping-guide-level-1)
- DoD CMMC Assessment Guide — Level 1 (/regulations/assessment-guide-level-1)
- DoD CMMC Model Overview (/regulations/model-overview)

When the user asks about a rule, call \`cite_regulation\` for the verbatim text AND point them at the specific /regulations/[slug] page so they can read the source PDF in-browser.`,
};

function buildRegulationsDocPack(route: string): Pack {
  const slug = route.split("/").pop() ?? "";
  const docs: Record<string, { title: string; cite: string; what: string }> = {
    "scoping-guide-level-1": {
      title: "CMMC Scoping Guide — Level 1 (v2.13)",
      cite: "DoD-CIO-00005, September 2024",
      what: "How to draw the boundary: FCI assets, specialized assets, out-of-scope assets, people, technology, facilities, ESPs.",
    },
    "assessment-guide-level-1": {
      title: "CMMC Assessment Guide — Level 1 (v2.13)",
      cite: "DoD-CIO-00002, September 2024",
      what: "Per-practice NIST 800-171A objectives, assessment methods (Examine/Interview/Test), evidence examples, MET / NOT MET rules.",
    },
    "model-overview": {
      title: "CMMC Model Overview (v2.13)",
      cite: "DoD-CIO-00001, September 2024",
      what: "The full model: three levels, fourteen domains, complete practice matrix mapped to FAR 52.204-21 and NIST 800-171.",
    },
  };
  const doc = docs[slug];
  if (!doc) {
    return {
      label: "Regulations document viewer",
      goal: "Help the user understand the document they're reading.",
      preferredTools: ["cite_regulation"],
      avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
      body: "If the user asks a question this PDF can answer, point to the relevant page or section.",
    };
  }
  return {
    label: `Reading: ${doc.title}`,
    goal: "Answer questions the user has about this specific DoD source document.",
    preferredTools: ["cite_regulation", "read_assessment_state"],
    avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
    body: `Document: ${doc.title} (${doc.cite}).
What it covers: ${doc.what}

When the user asks a question:
1. If it's "what does the rule actually say about X?", use \`cite_regulation\` to return the verbatim text.
2. If it's "how does this apply to MY business?", call \`read_assessment_state\` first, then map the rule onto their specific facts.
3. Do NOT paraphrase the rule and call it the rule. If you can't cite chapter and verse, say so and recommend the user open the PDF tab on this page.`,
  };
}

const PACK_OPPORTUNITIES: Pack = {
  label: "Opportunities (SAM.gov inbox)",
  goal: "Help the user evaluate fit on federal contract opportunities pulled from SAM.gov.",
  preferredTools: [
    "search_sam_opportunities",
    "list_inbox_opportunities",
    "analyze_opportunity_fit",
    "dismiss_opportunity",
  ],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset", "set_affirming_official"],
  body: `Workflow:
- If the user asks "what's in my inbox", call \`list_inbox_opportunities\`.
- If the user describes what they want to bid on, call \`search_sam_opportunities\` with NAICS / keywords from their profile.
- For each opportunity they're considering, call \`analyze_opportunity_fit\` to surface red flags (CMMC level required, set-aside, NAICS match, due date, prime-only).
- If an opportunity is clearly not a fit, offer \`dismiss_opportunity\` to clean their inbox.`,
};

const PACK_OPPORTUNITY_DETAIL: Pack = {
  label: "Opportunity detail",
  goal: "Walk the user through whether to pursue this specific opportunity.",
  preferredTools: ["analyze_opportunity_fit", "read_assessment_state", "cite_regulation"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: "Surface CMMC level required, NAICS match against the user's profile, due-date risk, and prime-vs-sub posture. If the opportunity requires CMMC L2 and the user is only at L1, say so plainly.",
};

const PACK_USER_PROFILE: Pack = {
  label: "User profile",
  goal: "Help the user manage their account / org membership.",
  preferredTools: [],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset", "set_affirming_official"],
  body: "Personal account settings. Compliance work happens in /assessments.",
};

const PACK_TRUST: Pack = {
  label: "Trust center (Custodia's own trust page)",
  goal: "Help the user understand Custodia's security posture.",
  preferredTools: ["cite_regulation"],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: "This is Custodia's public trust center. If the user has questions about Custodia's own compliance (subprocessors, DPA, security controls), answer from this page.",
};

const PACK_VERIFIED_PUBLIC: Pack = {
  label: "Public verified-contractor page",
  goal: "Show the user the public-facing CMMC L1 verified page for an org.",
  preferredTools: [],
  avoidTools: ["add_scope_item", "add_esp", "add_specialized_asset"],
  body: "This is a public page anyone can view. If the visitor is signed in and wondering how to get verified themselves, point them at /onboard.",
};

const PACK_GENERIC: Pack = {
  label: "General",
  goal: "Answer the user's question. If they need compliance work, route them to /assessments. If they need a regulation citation, route them to /regulations.",
  preferredTools: ["read_assessment_state", "cite_regulation"],
  avoidTools: [],
  body: "",
};
