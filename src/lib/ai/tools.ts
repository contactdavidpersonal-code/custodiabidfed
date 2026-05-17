import {
  escalationUrgencies,
  getSql,
  milestoneKinds,
  scopeKinds,
  specializedAssetTypes,
  type EscalationUrgency,
  type MilestoneKind,
  type ScopeKind,
  type SpecializedAssetType,
} from "@/lib/db";
import {
  computeProgress,
  evidenceReviewBlockers,
  getBusinessProfile,
  getAssessmentForUser,
  listAssessmentsForOrg,
  listEvidenceForAssessment,
  listEvidenceForControl,
  listResponsesForAssessment,
  tagArtifactPractice,
  untagArtifactPractice,
  updateBusinessProfile,
} from "@/lib/assessment";
import { playbookById, practiceObjectives, legacyToRequirement } from "@/lib/playbook";
import { fiscalYearOf } from "@/lib/fiscal";
import {
  controlCitations,
  frameworkCitations,
  lookupCitation,
} from "@/lib/regulations";
import {
  dismissOpportunity,
  listOpportunitiesForOrg,
  SamApiKeyError,
  searchSamOpportunities,
  type SamOpportunity,
} from "@/lib/sam-radar";
import {
  addEsp,
  addScopeItem,
  addSpecializedAsset,
  deleteEsp,
  deleteSpecializedAsset,
  listEsps,
  listScopeItems,
  listSpecializedAssets,
  retireScopeItem,
  updateEsp,
  updateScopeItem,
  updateSpecializedAsset,
} from "@/lib/cmmc/scope";
import {
  listObjectivesForAssessment,
  seedObjectiveRows,
  setObjectiveResponse,
  setControlException,
  clearControlException,
  controlsBlockingAffirmation,
  type ObjectiveResponseRow,
} from "@/lib/cmmc/objectives";
import { getSamEntityStatus, summarizeSamStatus } from "@/lib/sam-entity";
import { recomputeTrustStatus } from "@/lib/trust-status";
import { fileMaterialChange } from "@/lib/cmmc/material-changes";
import {
  appendInterviewTurn,
  answerLastInterviewTurn,
  askNextInterviewQuestion,
  critiqueControlNarrative,
  draftControlNarrative,
  gatherControlContext,
  getOrCreateInterviewSession,
  hasMinimumContext,
  markResponseInProgress,
  markSessionDrafted,
  recordCritique,
  saveNarrative,
} from "@/lib/cmmc/narrative-copilot";
import { recordAuditEvent } from "@/lib/security/audit-log";
import {
  assembleBoundaryView,
  getScopeProfile,
  patchScopeProfile,
  validateBoundary,
  findingCounts,
  isReadyForSsp,
  type AffirmingOfficial,
  type FlowChannel,
  type FlowDirection,
  type OutOfScopeItem,
  type ScopeFlow,
} from "@/lib/cmmc/boundary";
import { randomUUID } from "node:crypto";
import { getPracticeSpec, personalizeSpec } from "@/lib/cmmc/practice-spec";
import { saveIntakeStep } from "@/lib/cmmc/practice-chat";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

/**
 * Tools the left-rail compliance officer can call. Kept deliberately small
 * and read-mostly — the one mutating tool (propose_milestone) writes a single
 * row the user can dismiss. Anything riskier (editing responses, deleting
 * evidence, submitting the affirmation) stays a human-only action.
 */
export const officerTools = [
  {
    name: "read_assessment_state",
    description:
      "Returns the current state of the user's active assessment: fiscal year, cycle label, status counts (met / partial / not met / N/A / unanswered), per-control statuses, and evidence counts. Use this whenever the user asks 'where am I', 'what's left', or references their progress.",
    input_schema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description:
            "Optional UUID of a specific assessment. If omitted, uses the assessment the user is currently viewing, or the most recent in_progress cycle.",
        },
      },
      required: [],
    },
  },
  {
    name: "describe_evidence",
    description:
      "Fetch the stored AI vision review for an evidence artifact (verdict, summary, mapped controls). Use this when the user asks about a specific upload — do NOT speculate about what's in a file; read this first.",
    input_schema: {
      type: "object" as const,
      properties: {
        artifact_id: {
          type: "string",
          description: "UUID of the evidence_artifacts row.",
        },
      },
      required: ["artifact_id"],
    },
  },
  {
    name: "suggest_narrative",
    description:
      "Generate a plain-English narrative draft for a specific control, grounded in the playbook and the org's business context. The result can be pasted into the narrative field. Use when the user asks 'write this for me' or 'what should I say'.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: {
          type: "string",
          description:
            "Legacy CMMC L1 practice ID, e.g. 'AC.L1-3.1.1'. Must map to one of the 15 v2.13 safeguarding requirements (FAR 52.204-21(b)(1)(i)–(b)(1)(xv)).",
        },
        assessment_id: {
          type: "string",
          description: "Optional assessment UUID; defaults to the active one.",
        },
      },
      required: ["control_id"],
    },
  },
  {
    name: "check_readiness",
    description:
      "Audit the active assessment against the attestation gate: profile completeness, unanswered controls, any 'no' or 'partial' answers, and evidence-review blockers. Returns a punch list of exactly what's stopping the user from signing today.",
    input_schema: {
      type: "object" as const,
      properties: {
        assessment_id: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "propose_milestone",
    description:
      "Add a one-off compliance milestone (reminder) to the user's fiscal-year calendar. Use when the user says 'remind me to do X on Y date' or you identify a business-specific recurring task that the quarterly defaults don't cover.",
    input_schema: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string",
          enum: milestoneKinds as unknown as string[],
          description: "Use 'custom' for ad-hoc user requests.",
        },
        title: { type: "string" },
        description: { type: "string" },
        due_date: {
          type: "string",
          description: "ISO date YYYY-MM-DD.",
        },
      },
      required: ["kind", "title", "due_date"],
    },
  },
  {
    name: "update_organization_fields",
    description:
      "Persist identity fields on the user's organization row (legal name, entity type, SAM UEI, CAGE code, NAICS codes, scoped systems paragraph). Only pass fields the user has actually confirmed — never guess. Use during onboarding and whenever the user corrects an identity detail.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Legal entity name." },
        entity_type: {
          type: "string",
          description: "LLC, Corp, Sole proprietor, etc.",
        },
        sam_uei: {
          type: "string",
          description: "12-character SAM.gov Unique Entity Identifier.",
        },
        cage_code: {
          type: "string",
          description: "5-character CAGE code.",
        },
        naics_codes: {
          type: "array",
          items: { type: "string" },
          description: "NAICS codes, e.g. ['541330','561730'].",
        },
        scoped_systems: {
          type: "string",
          description:
            "One-paragraph plain-English description of the environment where federal contract info lives. Goes directly onto the SSP.",
        },
      },
      required: [],
    },
  },
  {
    name: "update_business_profile",
    description:
      "Merge structured business-context facts into the org's business_profile.data JSON. Call this EAGERLY — every time the user reveals a fact during onboarding, write it immediately. Use the EXACT canonical keys listed below; the profile UI reads these literal strings. Always re-estimate completeness_score (0-100) based on total facts captured.\n\nCANONICAL KEYS (use these literal strings — do not invent variants):\n  experience_level: 'first_timer' | 'exploring' | 'subcontractor' | 'experienced'\n  what_they_do: one sentence on the product/service the business delivers\n  customers: one sentence on who they sell to (e.g. 'DoD primes', 'civilian agencies', 'commercial only — trying to break into federal')\n  team_size: number, range, or descriptor (e.g. '1 — solo founder', '4 FTE + 2 contractors', '12')\n  physical_workspace: where work physically happens (e.g. 'home office, no visitors', 'leased 2,000 sqft office', 'shared coworking')\n  it_identity: 'microsoft 365' | 'google workspace' | 'okta' | 'mixed' | 'none' | 'unknown — still deciding'\n  data_location: where FCI actually lives (e.g. 'sole personal laptop', 'SharePoint tenant', 'on-prem file server')\n  customer_facing_product: 'saas' | 'hardware' | 'services-only' | 'none'\n  network: 'remote' | 'single office' | 'mixed'\n  contract_status: 'not_in_sam' | 'sam_no_wins' | 'active_subcontractor' | 'active_prime'\n  prior_compliance: 'none' | 'NIST CSF' | 'ISO 27001' | 'SOC 2' | 'earlier CMMC' | freeform\n\nIf a value is genuinely unknown (e.g. user said 'I'm not sure yet'), write the literal string 'unknown — <short reason>' so the UI shows partial progress instead of leaving the slot empty. NEVER omit a key the user has actually answered, even partially.",
    input_schema: {
      type: "object" as const,
      properties: {
        data: {
          type: "object",
          description:
            "Key/value facts to MERGE (not replace) into business_profile.data. Use the canonical keys from the tool description. Extra keys are allowed but the canonical ones are what render on the user's profile page.",
        },
        completeness_score: {
          type: "number",
          description:
            "Estimated completeness 0-100. 40 is the minimum to leave onboarding; 70+ means the officer can give richly personalized guidance. Roughly +8 per canonical key captured.",
        },
      },
      required: ["data", "completeness_score"],
    },
  },
  {
    name: "cite_regulation",
    description:
      "Look up the authoritative regulatory text for a CMMC L1 requirement (by legacy NIST 800-171 r2 control id like 'AC.L1-3.1.1' OR by v2.13 requirement id like 'AC.L1-b.1.i') OR a program-level topic (slug). ALWAYS call this before quoting FAR / NIST / 32 CFR / DFARS text — never paraphrase the regs from memory. Include the returned 'source' field verbatim when you quote in your answer so the user sees the citation. Valid framework slugs: 'cmmc-l1-scope', 'cmmc-l1-scoping', 'cmmc-l1-findings', 'fci-definition', 'affirmation-liability', 'sprs-submission', 'sam-registration', 'annual-cadence', 'dfars-7021', 'dfars-7025', 'enduring-exception', 'temporary-deficiency', 'assessment-objective', 'external-service-provider'.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description:
            "A legacy control id (e.g. 'AC.L1-3.1.1', 'SI.L1-3.14.5'), a v2.13 requirement id (e.g. 'AC.L1-b.1.i', 'SI.L1-b.1.xv'), OR a framework slug (e.g. 'cmmc-l1-scope', 'dfars-7021', 'enduring-exception', 'temporary-deficiency').",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "search_sam_opportunities",
    description:
      "Live search of SAM.gov for federal contract opportunities. Use this whenever the user asks 'what contracts are out there', 'find me opportunities', 'search for X work', 'what's coming up in [agency/keyword]', or wants to research outside the weekly digest. The Platform's SAM.gov API key is shared — the user does not need to supply one. If `naics_codes` is omitted, the org's stored NAICS are used by default. Returns up to 25 active solicitations with title, agency, NAICS, set-aside, deadline, and the SAM.gov deeplink. Always call this BEFORE recommending opportunities — never invent notice IDs or solicitation numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        naics_codes: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional NAICS codes to search. If omitted, defaults to the org's stored NAICS list. Pass an empty array [] to search across ALL NAICS (used with a keyword).",
        },
        keyword: {
          type: "string",
          description:
            "Optional title keyword filter (case-insensitive). E.g. 'cyber', 'lawn maintenance', 'AI'. Use when the user asks about a specific kind of work.",
        },
        set_aside: {
          type: "string",
          description:
            "Optional SAM set-aside code: SBA (Small Business), SDVOSBC (SDVOSB), WOSB, EDWOSB, HZC (HUBZone), 8A, IEE (Indian Economic Enterprise), ISBEE (Indian Small Business). Use when the user wants only socioeconomic set-asides they qualify for.",
        },
        posted_within_days: {
          type: "number",
          description:
            "How recent the postings must be (default 14, max 90). Increase for slow-moving NAICS, decrease for very fresh.",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 25, max 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_inbox_opportunities",
    description:
      "Read the user's already-radared opportunities saved in the platform inbox (from prior weekly digests). Use when the user says 'what did you send me', 'what's in my inbox', 'show me last week's matches', or wants to revisit something they saw before. Faster than search_sam_opportunities and reflects exactly what the user has on the /opportunities page.",
    input_schema: {
      type: "object" as const,
      properties: {
        include_dismissed: {
          type: "boolean",
          description:
            "If true, include opportunities the user already cleared. Default false.",
        },
        limit: {
          type: "number",
          description: "Max rows to return (default 25, max 100).",
        },
      },
      required: [],
    },
  },
  {
    name: "analyze_opportunity_fit",
    description:
      "Pull the full structured detail for a single opportunity (description, deadline, set-aside, place of performance, NAICS) so you can give the user a fit analysis: does the org's profile match? what evidence/capabilities do they need? is the deadline realistic? what's the past-performance gap? Call this BEFORE giving any 'should we bid' opinion. Accepts either a SAM notice ID (when the opp was returned by search_sam_opportunities) or an inbox row UUID.",
    input_schema: {
      type: "object" as const,
      properties: {
        notice_id: {
          type: "string",
          description:
            "SAM.gov notice_id (returned by search_sam_opportunities or visible on the opportunity card).",
        },
        inbox_id: {
          type: "string",
          description:
            "UUID of a row from list_inbox_opportunities. Use this for items already saved to the user's platform inbox.",
        },
      },
      required: [],
    },
  },
  {
    name: "dismiss_opportunity",
    description:
      "Clear an opportunity from the user's inbox once they've decided it isn't a fit. Only call this when the user explicitly says 'not interested', 'skip that one', 'remove from my list'. The dismissal is reversible from the in-app inbox.",
    input_schema: {
      type: "object" as const,
      properties: {
        inbox_id: {
          type: "string",
          description: "UUID of the inbox row (from list_inbox_opportunities).",
        },
      },
      required: ["inbox_id"],
    },
  },
  {
    name: "generate_evidence_artifact",
    description:
      "Generate a real evidence artifact directly into the user's evidence vault for the practice they're currently working on. Use this when the user has given you enough information to fill an evidence slot AND that slot's destinations include 'generated' (rosters, service-account lists, written procedures, scoping statements). DO NOT type the artifact's full content into chat — call this tool, and the artifact appears in the middle pane's Evidence section ready for the user to download or replace. CRITICAL — NO PRE-ANNOUNCING: when the user confirms (e.g. 'yes', 'generate them', 'do it'), your IMMEDIATE next response MUST be the generate_evidence_artifact tool_use block(s) — NOT a text line like 'Generating now…' or 'Creating the four artifacts…'. The platform automatically renders a live 'Drafting evidence' progress chip in the chat for every running tool call, so any text pre-announcement is duplicate noise AND causes the agent loop to end without ever calling the tool. The summary text goes AFTER the tool_use blocks finish, in your next assistant message. FORMAT CHOICE: default to 'pdf' for procedures, rosters, scoping statements, and any narrative deliverable — the platform renders these into a branded, themed PDF with serif typography, cream/navy letterhead, the org name, the control id, an effective date, and a page footer. The PDF is the deliverable the user hands to their assessor. Use 'csv' ONLY for raw tabular data exports the user or an assessor will load into a spreadsheet (e.g. authorized users roster, patch log). Use 'markdown' / 'text' only when the user explicitly asks for plain-text source. After the tool_use block(s) complete, give a 1-2 sentence chat summary of what you produced, e.g. 'I dropped a branded Authorized Users Roster PDF into your evidence — it lists you as the sole user, on Windows 11 + Pixel 9a. Replace it if anything's wrong.' Do NOT call this tool for evidence that requires a screenshot or live system export — those still need the user to upload manually or connect M365/Google Workspace. BATCHING: when the user asks you to generate MULTIPLE artifacts at once (e.g. 'yes, generate the first four'), emit ALL of the generate_evidence_artifact tool_use blocks in a SINGLE assistant message — parallel tool use is supported and is far faster than serializing them across multiple turns. Then summarize all artifacts in one closing text reply.",
    input_schema: {
      type: "object" as const,
      properties: {
        slot_key: {
          type: "string",
          description:
            "Exact key of the evidence slot from the active practice's spec (e.g. 'authorized_users_roster', 'service_accounts_list', 'access_procedure'). Must match a slot in the spec for the active practice.",
        },
        filename: {
          type: "string",
          description:
            "Filename WITHOUT extension (the platform appends the right one based on `format`). Use kebab-case, e.g. 'authorized-users-roster', 'access-grant-removal-procedure'. If you include an extension the platform will strip and replace it.",
        },
        format: {
          type: "string",
          enum: ["pdf", "csv", "markdown", "text"],
          description:
            "'pdf' = branded, themed deliverable rendered from lightweight Markdown (`#` / `##` headings, `- ` bullets, `1. ` numbered lists, blank-line paragraphs, `**bold**` / `*italic*`). USE PDF for procedures, scoping statements, roster summaries — anything narrative. 'csv' = raw RFC4180 tabular data, header row required. 'markdown' / 'text' = plain text source, only when the user asks for it.",
        },
        content: {
          type: "string",
          description:
            "Full file content. For 'pdf', author it as lightweight Markdown — the renderer styles `#`/`##`/`###` headings, bullets, numbered lists, and paragraph breaks. Start with a single `# Title` line; the platform promotes it to the cover headline. For 'csv', include the header row. Be specific to the user's environment using only facts they have actually confirmed — never invent names, emails, or system details.",
        },
        summary: {
          type: "string",
          description:
            "One-sentence summary of what this artifact proves and how it satisfies the slot. Stored on the artifact for the assessor to read.",
        },
      },
      required: ["slot_key", "filename", "format", "content", "summary"],
    },
  },
  {
    name: "set_intake_answer",
    description:
      "Fill in ONE answer of the practice's intake quiz on the user's behalf. Use this when the user clicked a 'Help me pick this one' button or you've gathered enough plain-English information to confidently choose one of the available option values for a single question. Workflow: (1) ask ONE short plain-English question if you don't already have what you need (e.g. 'What do you use for email — Gmail, Outlook, Proton, something else?'), (2) when the user answers, map their reply to one of the allowed option values for that question, (3) call this tool once with question_id and value. After the tool returns ok, announce in one short sentence what you picked AND why ('I picked \"Just my email + my laptop\" because Proton + one laptop = solo operator setup'). If the practice has more unanswered questions, immediately ask the NEXT plain-English question OR call set_intake_answer again if you already know that answer too — parallel tool use is supported. NEVER ask the user to read the option labels themselves; they're here because they can't self-classify.",
    input_schema: {
      type: "object" as const,
      properties: {
        question_id: {
          type: "string",
          description:
            "The id of the intake question you're filling in (e.g. 'fci_location', 'provisioning_method', 'deprovisioning_speed', 'external_actors'). Must match a question in the active practice's intake spec.",
        },
        value: {
          type: "string",
          description:
            "The option value you picked. Must match one of the question's option values exactly (e.g. 'solo_email_laptop', 'solo_only_me', 'managed_only'). The server validates this — if it isn't a valid option for the question you'll get an error back.",
        },
      },
      required: ["question_id", "value"],
    },
  },
  {
    name: "add_scope_item",
    description:
      "Add a People / Technology / Facility row to the org's CMMC L1 scope inventory (32 CFR § 170.19(b)(3)). MANDATORY workflow: (1) call read_scope_inventory_state first to know what's already there, (2) get explicit user confirmation for the specific row, (3) THEN call this tool exactly once for that row. Each call writes ONE item. The server is now idempotent (case-insensitive label match within kind) and will return already_existed: true instead of duplicating — if you see that flag, stop and tell the user it was already on the list. Do NOT call this for ESPs (use add_esp) or for IoT / IIoT / OT / GFE / restricted / test_equipment (use add_specialized_asset).",
    input_schema: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string",
          enum: ["people", "technology", "facility"],
          description:
            "'people' = employees, contractors, roles. 'technology' = laptops, servers, SaaS, cloud accounts, network gear. 'facility' = offices, labs, warehouses, home offices.",
        },
        label: {
          type: "string",
          description:
            "Short identifying name. People: full name or role. Technology: hostname/app name. Facility: address or building name.",
        },
        role: {
          type: "string",
          description:
            "What this item does in the FCI flow. People: job title (e.g. 'Founder/CEO'). Technology: function (e.g. 'primary laptop', 'M365 email'). Facility: building purpose (e.g. 'home office, no visitors').",
        },
        handles_fci: {
          type: "boolean",
          description:
            "True if this item processes, stores, or transmits FCI. Defaults to true.",
        },
        notes: { type: "string", description: "Optional extra context." },
      },
      required: ["kind", "label"],
    },
  },
  {
    name: "add_esp",
    description:
      "Register an External Service Provider (ESP) in the user's scope inventory. Vendors and managed services that process, store, or transmit FCI on the OSA's behalf — Microsoft 365, Google Workspace, AWS, MSPs, contracted helpdesks. Per CMMC Scoping Guide L1 v2.13 ESPs are in scope and may share/inherit objectives when supporting evidence (SOC 2, attestation, contract responsibility matrix) is on file. MANDATORY workflow: (1) read_scope_inventory_state first, (2) confirm the specific ESP with the user, (3) THEN call this tool once. The server refuses duplicates by lower(name) and returns already_existed: true — if you see that, stop and report it was already registered.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Service name as the user refers to it. e.g. 'Microsoft 365 Business Standard', 'AWS production account', 'Acme MSP'.",
        },
        vendor: { type: "string", description: "Provider company, e.g. 'Microsoft'." },
        services: {
          type: "string",
          description:
            "What the provider does for the org. e.g. 'Email, document storage, identity, conditional access'.",
        },
        cmmc_status: {
          type: "string",
          description:
            "If known, the provider's CMMC posture: 'Final Level 2 (C3PAO)', 'GCC High', 'FedRAMP Moderate', 'Self-attested L1', or 'Unknown'.",
        },
        contact_email: { type: "string" },
        attestation_doc_url: {
          type: "string",
          description: "URL to SOC 2, ISO 27001, or CMMC attestation evidence.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "add_specialized_asset",
    description:
      "Document a Specialized Asset per 32 CFR § 170.19(b)(2)(ii). Specialized Assets — IoT, IIoT, Operational Technology, Government-Furnished Equipment, Restricted Information Systems, Test Equipment — are listed for completeness but NOT graded against the 15 requirements. Use this when the user mentions a connected sensor, lab fixture, GFE laptop, air-gapped test bench, etc. MANDATORY workflow: (1) read_scope_inventory_state first, (2) confirm with the user, (3) THEN call this tool once. The server refuses duplicates by (asset_type, lower(label)) and returns already_existed: true — if you see that, stop and report it.",
    input_schema: {
      type: "object" as const,
      properties: {
        label: {
          type: "string",
          description: "Short identifying name, e.g. 'Test bench RT-2', 'Smart printer (lobby)'.",
        },
        asset_type: {
          type: "string",
          enum: specializedAssetTypes as unknown as string[],
          description:
            "iot = consumer IoT. iiot = industrial IoT. ot = operational technology. gfe = Government-Furnished Equipment. restricted = Restricted Information System. test_equipment = test/lab equipment.",
        },
        description: { type: "string" },
        handles_fci: {
          type: "boolean",
          description:
            "True if the asset processes, stores, or transmits FCI. Defaults to true.",
        },
      },
      required: ["label", "asset_type"],
    },
  },
  {
    name: "read_scope_inventory_state",
    description:
      "Read the org's current scope inventory: People, Technology, Facilities, ESPs, and Specialized Assets. Call this before adding scope items so you don't duplicate, and at the start of the scope step to summarize what's already captured.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "read_boundary_state",
    description:
      "Read the org's FCI Boundary state: assembled view (people, technology, facilities, ESPs, flows, out-of-scope, affirming official) plus validation findings (pass/warn/fail with control refs). Call this at the start of the boundary step and any time the user asks 'what's missing for the SSP' or 'am I ready'. The findings tell you exactly which fail/warn rows still block SSP generation.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "set_affirming_official",
    description:
      "Capture the named human who will sign the SPRS affirmation for this organization. Required before SSP generation. The affirming official MUST be a senior official with authority to attest on behalf of the entity (owner, CEO, president, CFO, sole proprietor) — NOT an MSP, NOT a consultant, NOT this platform. Pass all three fields together. acknowledged_at is reset on every edit; the user must re-acknowledge in the workspace UI.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Full legal name of the signer." },
        title: {
          type: "string",
          description:
            "Their title (e.g. 'Owner', 'President', 'Sole Proprietor', 'CEO').",
        },
        email: {
          type: "string",
          description: "Direct contact email — must reach the named person.",
        },
      },
      required: ["name", "title", "email"],
    },
  },
  {
    name: "add_fci_flow",
    description:
      "Document a single inbound, outbound, or internal FCI data flow on the boundary. Examples: prime emails specs (inbound, email), uploads deliverable to Exostar (outbound, prime_portal), SharePoint syncs to laptops (internal, internal_sync). Call once per flow. Read boundary state first to avoid duplicates. The SSP needs at minimum one inbound and one outbound flow before generation.",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["inbound", "outbound", "internal"],
          description:
            "inbound = FCI enters the boundary. outbound = FCI leaves. internal = stays inside but moves between assets.",
        },
        channel: {
          type: "string",
          enum: [
            "prime_portal",
            "email",
            "sftp",
            "api",
            "removable_media",
            "paper",
            "internal_sync",
            "other",
          ],
          description:
            "How the data moves. prime_portal = vendor portal like Exostar/PIEE. internal_sync = OneDrive/SharePoint sync.",
        },
        description: {
          type: "string",
          description:
            "One-sentence plain-English description, e.g. 'Prime sends drawings via Exostar; Romero downloads to SharePoint'.",
        },
        counterparty: {
          type: "string",
          description:
            "Who is on the other end (omit for internal). e.g. 'Lockheed Martin RMS', 'DoD SPRS'.",
        },
      },
      required: ["direction", "channel", "description"],
    },
  },
  {
    name: "add_out_of_scope_item",
    description:
      "Declare an asset / system as explicitly OUT of FCI scope. Each row needs (1) what it is, (2) why no FCI touches it, (3) how it is segregated from in-scope assets. Reviewers expect this list — assume nothing is out of scope by default. Common entries: marketing site, accounting system, BYOD phones, shop-floor equipment, public-facing apps.",
    input_schema: {
      type: "object" as const,
      properties: {
        asset: {
          type: "string",
          description:
            "Short name of the asset. e.g. 'acme-machining.com', 'QuickBooks Online', 'BYOD phones'.",
        },
        reason: {
          type: "string",
          description:
            "Why FCI never touches this. e.g. 'Marketing only — no DoD content', 'Invoices contain PO numbers, no FCI'.",
        },
        segregation: {
          type: "string",
          description:
            "How it is technically/contractually segregated from in-scope assets. e.g. 'Hosted Squarespace, no integration with M365 tenant', 'Conditional Access blocks SharePoint on unmanaged devices'.",
        },
      },
      required: ["asset", "reason", "segregation"],
    },
  },
  {
    name: "escalate_to_officer",
    description:
      "Flag a request for a human Custodia officer (Bootcamp / Command tier). Use when the user's situation needs judgment beyond L1 self-serve — e.g. a prime is demanding an SSP rewrite, a guarantee claim dispute, CUI handling outside L1 scope, or they explicitly ask for human help.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "Short title, e.g. 'Prime SSP rewrite request'.",
        },
        urgency: {
          type: "string",
          enum: escalationUrgencies as unknown as string[],
        },
        summary: {
          type: "string",
          description:
            "2-4 sentences: what the user needs, what you've already tried, what you recommend the officer prepare.",
        },
      },
      required: ["topic", "urgency", "summary"],
    },
  },
  {
    name: "set_objective_status",
    description:
      "Set a NIST SP 800-171A objective verdict (a/b/c/d/e/f letter) for one of the 15 CMMC L1 practices. Status MET = the objective is satisfied. NOT_MET = a real gap that blocks attestation. NA = does-not-apply (must justify in rationale). EE = enduring exception (permanent business reason it can't be met). TD = temporary deficiency (will be remediated; pair with propose_milestone). Rationale is REQUIRED and MUST be at least 20 chars — this is what the user (or 3PAO) will read later. Do NOT call this without explicit user confirmation of the verdict and reasoning.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: {
          type: "string",
          description:
            "Legacy CMMC L1 practice ID, e.g. 'AC.L1-3.1.1'. Must be one of the 15 v2.13 safeguarding requirements.",
        },
        letter: {
          type: "string",
          enum: ["a", "b", "c", "d", "e", "f"],
          description: "The objective letter (a..f) under that practice.",
        },
        status: {
          type: "string",
          enum: ["MET", "NOT_MET", "NA", "EE", "TD"],
          description:
            "MET, NOT_MET, NA (not applicable), EE (enduring exception), TD (temporary deficiency).",
        },
        rationale: {
          type: "string",
          description:
            "Plain-English justification (≥ 20 chars). For NA: why it doesn't apply. For EE: the permanent business reason. For TD: what's broken and the fix plan. For MET: what specifically satisfies it.",
        },
        assessment_id: {
          type: "string",
          description: "Optional assessment UUID; defaults to active.",
        },
      },
      required: ["control_id", "letter", "status", "rationale"],
    },
  },
  {
    name: "remove_scope_item",
    description:
      "Retire (soft-delete) a scope_inventory row by id. Use when the user says 'we don't use that anymore' or 'drop that from scope'. Only retires — does not hard-delete history.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the scope_inventory row." },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_esp",
    description:
      "Delete an ESP from esp_registry by id. Use only when the user confirms they no longer use that provider AT ALL. If they just changed plans, prefer update_esp.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the esp_registry row." },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_specialized_asset",
    description:
      "Delete a specialized_assets row by id (IoT / OT / GFE / restricted). Use only on explicit user confirmation.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the specialized_assets row." },
      },
      required: ["id"],
    },
  },
  {
    name: "update_scope_item",
    description:
      "Patch fields on an existing scope_inventory row. Only supplied fields are changed; omitted fields stay as-is. Use this instead of remove+add when the user just wants to correct a detail.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the scope_inventory row." },
        label: { type: "string", description: "New display label." },
        role: { type: "string", description: "Role / description (people only)." },
        handles_fci: {
          type: "boolean",
          description: "Whether this asset handles FCI.",
        },
        notes: { type: "string", description: "Free-text notes." },
      },
      required: ["id"],
    },
  },
  {
    name: "update_esp",
    description:
      "Patch fields on an existing esp_registry row. Only supplied fields are changed. Use to record a new attestation URL, change cmmc_status, fix contact email, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the esp_registry row." },
        name: { type: "string" },
        vendor: { type: "string" },
        services: { type: "string" },
        cmmc_status: { type: "string" },
        attestation_doc_url: { type: "string" },
        contact_email: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_specialized_asset",
    description:
      "Patch fields on an existing specialized_assets row. Only supplied fields are changed.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the specialized_assets row." },
        label: { type: "string" },
        asset_type: {
          type: "string",
          enum: specializedAssetTypes as unknown as string[],
        },
        description: { type: "string" },
        handles_fci: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "next_best_action",
    description:
      "Inspect the entire account state (business profile, SAM UEI, scope inventory, boundary, the 15 practices, affirming official, bid radar inbox) and return ONE prioritized next step plus any blockers. Returns {blockers:[…], next_step:{section, action, route, why}, pct_complete, est_minutes_to_attestation}. Use whenever the user asks 'what should I do next', 'where am I stuck', or after finishing a task.",
    input_schema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description: "Optional assessment UUID; defaults to active.",
        },
      },
      required: [],
    },
  },
  {
    name: "navigate_user_to",
    description:
      "Ask the client to navigate the user to a specific in-app page (e.g. the page for a specific practice, the scope page, the boundary page, an opportunity, attestation). The path MUST start with '/' and MUST be one of: /onboard, /assessments, /assessments/{id}, /assessments/{id}/controls/{controlId}, /assessments/{id}/boundary, /assessments/{id}/scope, /opportunities, /opportunities/{id}, /dashboard, /profile, /admin/sam. Use ONLY when the next step is clearly on a different page than the user is currently viewing.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Absolute in-app path starting with '/'. No external URLs, no protocol, no query strings with PII.",
        },
        reason: {
          type: "string",
          description:
            "Short reason shown back to the user. e.g. 'Open AC.L1-3.1.1 to grade objective (a)'.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "verify_sam_registration",
    description:
      "Look up a UEI in the SAM.gov Entity Management API and compare the result against the org profile. Returns active/inactive/not_found + legal name + expiration date + any mismatches (e.g. legal name differs, UEI doesn't match what's on file). Use when the user adds/changes UEI, or before recommending attestation.",
    input_schema: {
      type: "object" as const,
      properties: {
        uei: {
          type: "string",
          description:
            "Optional 12-char alphanumeric UEI. If omitted, uses the UEI on the organization record.",
        },
      },
      required: [],
    },
  },
  {
    name: "attach_evidence_to_objective",
    description:
      "Link an uploaded evidence artifact to a specific NIST 800-171A objective (control_id + letter). Merges into the existing objectives list for that (artifact, control) tag — does NOT clobber other letters already tagged. The artifact must already be uploaded for this assessment.",
    input_schema: {
      type: "object" as const,
      properties: {
        artifact_id: {
          type: "string",
          description: "UUID of the evidence_artifacts row.",
        },
        control_id: {
          type: "string",
          description: "Legacy CMMC L1 practice ID, e.g. 'AC.L1-3.1.1'.",
        },
        letter: {
          type: "string",
          enum: ["a", "b", "c", "d", "e", "f"],
          description: "Objective letter under that practice.",
        },
        assessment_id: {
          type: "string",
          description: "Optional assessment UUID; defaults to active.",
        },
      },
      required: ["artifact_id", "control_id", "letter"],
    },
  },
  {
    name: "remove_evidence_from_objective",
    description:
      "Remove a single objective letter from an artifact's tag on a practice. If the artifact had only that letter for that control, the entire tag row is deleted. Does NOT delete the artifact file itself — for that the user must use the Evidence page.",
    input_schema: {
      type: "object" as const,
      properties: {
        artifact_id: { type: "string" },
        control_id: { type: "string" },
        letter: {
          type: "string",
          enum: ["a", "b", "c", "d", "e", "f"],
        },
        assessment_id: { type: "string" },
      },
      required: ["artifact_id", "control_id", "letter"],
    },
  },
  {
    name: "record_exception",
    description:
      "Declare an Enduring Exception (EE — permanent business reason an objective can't be met) or Temporary Deficiency (TD — known gap with a remediation plan) at the CONTROL level. Sets exception_type + exception_notes on every not-met objective of that practice. For TD you MUST also call propose_milestone afterward (no plan-of-action = no rollup to MET).",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: {
          type: "string",
          description: "Legacy CMMC L1 practice ID, e.g. 'AC.L1-3.1.1'.",
        },
        kind: {
          type: "string",
          enum: ["enduring_exception", "temporary_deficiency"],
          description: "EE = permanent, TD = temporary with remediation plan.",
        },
        rationale: {
          type: "string",
          description:
            "Required justification (≥ 20 chars). For EE: the permanent business reason. For TD: what's broken and the fix.",
        },
        assessment_id: { type: "string" },
      },
      required: ["control_id", "kind", "rationale"],
    },
  },
  {
    name: "clear_exception",
    description:
      "Clear any EE/TD declaration from every objective under a control. Also hard-deletes the orphaned plan-of-action milestones. Use when the user remediated the gap and the practice now meets normally.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: { type: "string" },
        assessment_id: { type: "string" },
      },
      required: ["control_id"],
    },
  },
  {
    name: "preflight_affirmation",
    description:
      "Run the pre-attestation readiness check. Returns every blocker that would prevent the affirming official from signing: unanswered controls, NOT_MET with no exception, TD without milestones, evidence still pending review, boundary findings flagged 'fail'. Charlie MUST call this before recommending the user submit the attestation.",
    input_schema: {
      type: "object" as const,
      properties: {
        assessment_id: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "remove_fci_flow",
    description:
      "Delete an FCI flow row from the boundary by id. Use when the user says that channel no longer carries FCI.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID of the ScopeFlow." },
      },
      required: ["id"],
    },
  },
  {
    name: "update_fci_flow",
    description:
      "Patch an existing FCI flow. Only supplied fields are changed; others stay as-is.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        direction: { type: "string", enum: ["inbound", "outbound", "bidirectional", "internal"] },
        channel: {
          type: "string",
          enum: ["email", "portal", "sftp", "api", "removable_media", "paper", "internal_sync", "other"],
        },
        description: { type: "string" },
        counterparty: { type: "string" },
        touches_scope_item_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of scope_inventory ids touched by this flow.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_out_of_scope_item",
    description:
      "Delete an explicit out-of-scope declaration by id.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_out_of_scope_item",
    description:
      "Patch an existing out-of-scope item. Only supplied fields are changed.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        asset: { type: "string" },
        reason: { type: "string" },
        segregation: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "save_scoping_statement",
    description:
      "Persist a scoping-statement narrative onto the organization's scope_profile (free-text overview that appears under the boundary diagram). Use when the user approves a narrative draft (e.g. from suggest_narrative).",
    input_schema: {
      type: "object" as const,
      properties: {
        narrative: {
          type: "string",
          description:
            "The narrative text to persist. Pass an empty string to clear.",
        },
      },
      required: ["narrative"],
    },
  },
  {
    name: "regenerate_deliverable",
    description:
      "Re-render one of the org's compliance deliverables from current data. The CONTENT is never inlined in the response — the tool returns a download URL the user can click. Use after material profile/scope changes or when the user explicitly asks to refresh a doc. For 'trust_profile', this recomputes the live trust-status snapshot at /verified/{slug}.",
    input_schema: {
      type: "object" as const,
      properties: {
        kind: {
          type: "string",
          enum: ["ssp", "attestation", "bid_packet", "bid_package", "trust_profile"],
          description:
            "Which deliverable to regenerate. ssp = System Security Plan HTML. attestation = senior-official affirmation memo HTML. bid_packet = print-ready marketing/proposal packet (one HTML doc). bid_package = full ZIP with SSP + affirmation + CSVs + evidence files. trust_profile = public /verified/{slug} snapshot.",
        },
        assessment_id: {
          type: "string",
          description:
            "Optional. Defaults to the active assessment when omitted.",
        },
        draft: {
          type: "boolean",
          description:
            "Only for bid_package. When true allows export of an unsigned/draft package.",
        },
      },
      required: ["kind"],
    },
  },
  {
    name: "file_material_change",
    description:
      "File a § 170.22(d) Material Change record for the active assessment. Use when the user reports a change that may invalidate the current annual affirmation (new FCI flow, scope expansion, M&A, new ESP, etc.). Records the change to the material_changes audit table; if requires_reassessment is true, also flips the assessment-level snapshot so the affirmation bar re-prompts.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description:
            "Why this is a material change (≥ 20 chars). Cite the specific element that changed.",
        },
        changes: {
          type: "object",
          description:
            "Structured payload describing what changed (free-form key/value).",
          additionalProperties: true,
        },
        requires_reassessment: {
          type: "boolean",
          description:
            "True when the change forces a fresh self-assessment cycle.",
        },
        assessment_id: {
          type: "string",
          description: "Optional. Defaults to the active assessment.",
        },
      },
      required: ["reason", "changes"],
    },
  },
  {
    name: "draft_control_narrative",
    description:
      "Ghostwrite an SSP narrative paragraph for one CMMC L1 control, grounded in the org's profile, scope, and attached evidence. Returns a draft for the user to review — does NOT save. Use when the user asks Charlie to write, draft, ghostwrite, or improve the narrative for a specific control. If the org has too little context, returns needs_more_context=true and the caller should run interview_for_control_narrative first.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: {
          type: "string",
          description: "CMMC L1 control id, e.g. 'AC.L1-3.1.1'.",
        },
        assessment_id: {
          type: "string",
          description: "Optional. Defaults to the active assessment.",
        },
      },
      required: ["control_id"],
    },
  },
  {
    name: "interview_for_control_narrative",
    description:
      "Conversational interview to gather the org-specific facts needed to ghostwrite an SSP narrative for one control. Call with no `answer` to start (or to resume) — returns the next question. Call with `answer` to record the user's reply to the most recent question. When Charlie has enough context, returns ready=true and a final draft. State persists per (assessment, control, user) for 30 days.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: {
          type: "string",
          description: "CMMC L1 control id, e.g. 'AC.L1-3.1.1'.",
        },
        answer: {
          type: "string",
          description:
            "The user's reply to the most recent interview question. Omit on the first call.",
        },
        assessment_id: {
          type: "string",
          description: "Optional. Defaults to the active assessment.",
        },
      },
      required: ["control_id"],
    },
  },
  {
    name: "save_control_narrative",
    description:
      "Persist a narrative to control_responses.narrative for one control. Overwrites any existing narrative. Use after the user reviews a draft and confirms they want it saved (or after they hand-edit one). Rejects narratives shorter than 80 chars or longer than 4000.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: { type: "string" },
        narrative: { type: "string" },
        assessment_id: {
          type: "string",
          description: "Optional. Defaults to the active assessment.",
        },
      },
      required: ["control_id", "narrative"],
    },
  },
  {
    name: "critique_control_narrative",
    description:
      "C3PAO assessor-style critique of the currently-saved narrative for one control. Returns ready=true|false and a short weaknesses list. Read-only — does NOT modify the narrative. Records the critique to the audit history so the UI can later detect 'narrative unchanged since last critique'.",
    input_schema: {
      type: "object" as const,
      properties: {
        control_id: { type: "string" },
        assessment_id: {
          type: "string",
          description: "Optional. Defaults to the active assessment.",
        },
      },
      required: ["control_id"],
    },
  },
  {
    name: "bulk_draft_remaining_narratives",
    description:
      "Generate narrative drafts for every L1 control on the active assessment that has an empty or weak (< 80 chars) narrative. Returns an array of drafts for the user to review — does NOT save. Each draft is independent; the user picks which to keep. No cap — runs across all 15 L1 practices.",
    input_schema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description: "Optional. Defaults to the active assessment.",
        },
      },
      required: [],
    },
  },
];

export type ToolContext = {
  organizationId: string;
  userId: string;
  conversationId: string;
  activeAssessmentId?: string;
  activeControlId?: string;
};

export type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

/**
 * Scope-inventory mutators. These are valid on /scope and /boundary but must
 * be hard-refused on a practice page (/controls/[id]) to break any loop where
 * the model keeps firing add_scope_item even after the user has navigated
 * away. See the guard at the top of executeOfficerTool.
 */
const SCOPE_MUTATOR_TOOLS = new Set([
  "add_scope_item",
  "add_esp",
  "add_specialized_asset",
  "add_fci_flow",
  "add_out_of_scope_item",
]);

/**
 * Dispatch a tool call from the model. Each handler is defensive: invalid
 * input returns `{ ok: false, error }` rather than throwing, so the agent
 * loop can surface the error to the model and it can self-correct.
 */
export async function executeOfficerTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // Server-side page-scope guard. Per-page packs in page-context.ts tell the
  // model which tools belong where, but a polluted conversation history (e.g.
  // a long scope-inventory thread) can keep the model re-firing scope adds
  // even after the user navigates to a control page. We refuse them outright
  // so the loop terminates and the model gets an explicit redirect instead.
  if (ctx.activeControlId && SCOPE_MUTATOR_TOOLS.has(name)) {
    return {
      ok: false,
      error: `Tool '${name}' is not available on a practice page (you're on ${ctx.activeControlId}). Scope inventory edits live on /scope and /boundary. Tell the user to head to the Scope tab if they want to add a person, device, vendor, or facility. On this page use the narrative copilot tools instead (interview_for_control_narrative, draft_control_narrative, save_control_narrative, critique_control_narrative).`,
    };
  }

  try {
    switch (name) {
      case "read_assessment_state":
        return await handleReadAssessmentState(input, ctx);
      case "describe_evidence":
        return await handleDescribeEvidence(input, ctx);
      case "suggest_narrative":
        return await handleSuggestNarrative(input, ctx);
      case "check_readiness":
        return await handleCheckReadiness(input, ctx);
      case "propose_milestone":
        return await handleProposeMilestone(input, ctx);
      case "update_organization_fields":
        return await handleUpdateOrganizationFields(input, ctx);
      case "update_business_profile":
        return await handleUpdateBusinessProfile(input, ctx);
      case "cite_regulation":
        return await handleCiteRegulation(input);
      case "escalate_to_officer":
        return await handleEscalateToOfficer(input, ctx);
      case "generate_evidence_artifact":
        return await handleGenerateEvidenceArtifact(input, ctx);
      case "set_intake_answer":
        return await handleSetIntakeAnswer(input, ctx);
      case "search_sam_opportunities":
        return await handleSearchSamOpportunities(input, ctx);
      case "list_inbox_opportunities":
        return await handleListInboxOpportunities(input, ctx);
      case "analyze_opportunity_fit":
        return await handleAnalyzeOpportunityFit(input, ctx);
      case "dismiss_opportunity":
        return await handleDismissOpportunity(input, ctx);
      case "add_scope_item":
        return await handleAddScopeItem(input, ctx);
      case "add_esp":
        return await handleAddEsp(input, ctx);
      case "add_specialized_asset":
        return await handleAddSpecializedAsset(input, ctx);
      case "read_scope_inventory_state":
        return await handleReadScopeInventoryState(ctx);
      case "read_boundary_state":
        return await handleReadBoundaryState(ctx);
      case "set_affirming_official":
        return await handleSetAffirmingOfficial(input, ctx);
      case "add_fci_flow":
        return await handleAddFciFlow(input, ctx);
      case "add_out_of_scope_item":
        return await handleAddOutOfScopeItem(input, ctx);
      case "set_objective_status":
        return await handleSetObjectiveStatus(input, ctx);
      case "remove_scope_item":
        return await handleRemoveScopeItem(input, ctx);
      case "remove_esp":
        return await handleRemoveEsp(input, ctx);
      case "remove_specialized_asset":
        return await handleRemoveSpecializedAsset(input, ctx);
      case "update_scope_item":
        return await handleUpdateScopeItem(input, ctx);
      case "update_esp":
        return await handleUpdateEspTool(input, ctx);
      case "update_specialized_asset":
        return await handleUpdateSpecializedAssetTool(input, ctx);
      case "next_best_action":
        return await handleNextBestAction(input, ctx);
      case "navigate_user_to":
        return await handleNavigateUserTo(input, ctx);
      case "verify_sam_registration":
        return await handleVerifySamRegistration(input, ctx);
      case "attach_evidence_to_objective":
        return await handleAttachEvidenceToObjective(input, ctx);
      case "remove_evidence_from_objective":
        return await handleRemoveEvidenceFromObjective(input, ctx);
      case "record_exception":
        return await handleRecordException(input, ctx);
      case "clear_exception":
        return await handleClearException(input, ctx);
      case "preflight_affirmation":
        return await handlePreflightAffirmation(input, ctx);
      case "remove_fci_flow":
        return await handleRemoveFciFlow(input, ctx);
      case "update_fci_flow":
        return await handleUpdateFciFlow(input, ctx);
      case "remove_out_of_scope_item":
        return await handleRemoveOutOfScopeItem(input, ctx);
      case "update_out_of_scope_item":
        return await handleUpdateOutOfScopeItem(input, ctx);
      case "save_scoping_statement":
        return await handleSaveScopingStatement(input, ctx);
      case "regenerate_deliverable":
        return await handleRegenerateDeliverable(input, ctx);
      case "file_material_change":
        return await handleFileMaterialChange(input, ctx);
      case "draft_control_narrative":
        return await handleDraftControlNarrative(input, ctx);
      case "interview_for_control_narrative":
        return await handleInterviewForControlNarrative(input, ctx);
      case "save_control_narrative":
        return await handleSaveControlNarrative(input, ctx);
      case "critique_control_narrative":
        return await handleCritiqueControlNarrative(input, ctx);
      case "bulk_draft_remaining_narratives":
        return await handleBulkDraftRemainingNarratives(input, ctx);
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

async function resolveAssessmentId(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string | null> {
  const supplied = typeof input.assessment_id === "string" ? input.assessment_id : null;
  if (supplied) return supplied;
  if (ctx.activeAssessmentId) return ctx.activeAssessmentId;
  const all = await listAssessmentsForOrg(ctx.organizationId);
  const active = all.find((a) => a.status === "in_progress") ?? all[0];
  return active?.id ?? null;
}

async function handleReadAssessmentState(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via ctx.userId + getAssessmentForUser,
  // which enforces (assessment.organization_id IN user_orgs).
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) {
    return { ok: false, error: "No assessment found for this organization." };
  }
  const view = await getAssessmentForUser(assessmentId, ctx.userId);
  if (!view) {
    return { ok: false, error: "Assessment not found or not accessible." };
  }

  const responses = await listResponsesForAssessment(assessmentId);
  const progress = computeProgress(responses);
  const evidence = await listEvidenceForAssessment(assessmentId);

  const byStatus = {
    unanswered: responses.filter((r) => r.status === "unanswered").map((r) => r.control_id),
    no: responses.filter((r) => r.status === "no").map((r) => r.control_id),
    partial: responses.filter((r) => r.status === "partial").map((r) => r.control_id),
  };

  const evidenceByControl = new Map<string, number>();
  for (const e of evidence) {
    evidenceByControl.set(e.control_id, (evidenceByControl.get(e.control_id) ?? 0) + 1);
  }

  return {
    ok: true,
    data: {
      assessment_id: view.assessment.id,
      cycle_label: view.assessment.cycle_label,
      framework: view.assessment.framework,
      fiscal_year: view.assessment.fiscal_year,
      status: view.assessment.status,
      affirmed_at: view.assessment.affirmed_at,
      implements_all_17: view.assessment.implements_all_17,
      progress,
      needs_attention: byStatus,
      total_evidence: evidence.length,
      controls_with_evidence: Array.from(evidenceByControl.entries()).map(
        ([control_id, count]) => ({ control_id, count }),
      ),
    },
  };
}

async function handleDescribeEvidence(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.artifact_id === "string" ? input.artifact_id : null;
  if (!id) return { ok: false, error: "artifact_id is required." };

  const sql = getSql();
  const rows = (await sql`
    SELECT ea.id, ea.assessment_id, ea.control_id, ea.filename, ea.mime_type,
           ea.size_bytes, ea.captured_at,
           ea.ai_review_verdict, ea.ai_review_summary, ea.ai_review_mapped_controls,
           ea.ai_reviewed_at, ea.ai_review_model
    FROM evidence_artifacts ea
    JOIN assessments a ON a.id = ea.assessment_id
    WHERE ea.id = ${id} AND a.organization_id = ${ctx.organizationId}
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Artifact not found or not owned by this org." };
  }
  return { ok: true, data: row };
}

async function handleSuggestNarrative(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via ctx.userId + getAssessmentForUser,
  // which enforces (assessment.organization_id IN user_orgs).
  const controlId = typeof input.control_id === "string" ? input.control_id : null;
  if (!controlId) return { ok: false, error: "control_id is required." };

  const entry = playbookById[controlId];
  if (!entry) {
    return { ok: false, error: `Unknown control: ${controlId}` };
  }

  const assessmentId = await resolveAssessmentId(input, ctx);
  const view = assessmentId
    ? await getAssessmentForUser(assessmentId, ctx.userId)
    : null;
  if (!view) {
    return { ok: false, error: "No accessible assessment for this user." };
  }

  const evidence = assessmentId
    ? (await listEvidenceForAssessment(assessmentId)).filter(
        (e) => e.control_id === controlId,
      )
    : [];
  const mostRecent = evidence[0];

  const draft = entry.suggestedNarrative({
    companyName: view.organization.name,
    scopedSystems: view.organization.scoped_systems ?? "our primary work systems",
    capturedAt: (mostRecent?.captured_at ?? new Date().toISOString()).slice(0, 10),
    artifactFilename: mostRecent?.filename ?? "the captured evidence",
  });

  return {
    ok: true,
    data: {
      control_id: controlId,
      short_name: entry.shortName,
      far_reference: entry.farReference,
      draft_narrative: draft,
      has_supporting_evidence: evidence.length > 0,
    },
  };
}

async function handleCheckReadiness(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No assessment found." };
  const view = await getAssessmentForUser(assessmentId, ctx.userId);
  if (!view) return { ok: false, error: "Assessment not accessible." };

  const responses = await listResponsesForAssessment(assessmentId);
  const progress = computeProgress(responses);
  const evidence = await listEvidenceForAssessment(assessmentId);
  const blockers = evidenceReviewBlockers(evidence);
  const profile = await getBusinessProfile(ctx.organizationId);

  const issues: string[] = [];
  if (!profile || profile.completeness_score < 40) {
    issues.push(
      "Business profile is thin — the officer needs more context about what you do before the affirmation is defensible.",
    );
  }
  if (progress.unanswered > 0) {
    issues.push(`${progress.unanswered} control(s) still unanswered.`);
  }
  if (progress.notMet > 0) {
    issues.push(
      `${progress.notMet} control(s) marked 'Not met' — these must be fixed before you can affirm.`,
    );
  }
  if (progress.partial > 0) {
    issues.push(
      `${progress.partial} control(s) marked 'Partial' — tighten to full 'Met' or document the gap.`,
    );
  }
  if (blockers.length > 0) {
    issues.push(
      `${blockers.length} evidence artifact(s) have not passed AI review.`,
    );
  }

  return {
    ok: true,
    data: {
      assessment_id: assessmentId,
      ready_to_sign: issues.length === 0,
      progress,
      issues,
      evidence_blockers: blockers,
      profile_completeness: profile?.completeness_score ?? 0,
    },
  };
}

async function handleProposeMilestone(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const kind = typeof input.kind === "string" ? input.kind : "custom";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : null;
  const dueDate = typeof input.due_date === "string" ? input.due_date.trim() : "";

  if (!title) return { ok: false, error: "title is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, error: "due_date must be YYYY-MM-DD." };
  }
  if (!(milestoneKinds as readonly string[]).includes(kind)) {
    return { ok: false, error: `Invalid milestone kind: ${kind}` };
  }

  const fiscalYear = fiscalYearOf(new Date(dueDate + "T00:00:00Z"));
  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO compliance_milestones
      (organization_id, assessment_id, fiscal_year, kind, title, description, due_date)
    VALUES (
      ${ctx.organizationId}::uuid,
      ${ctx.activeAssessmentId ?? null}::uuid,
      ${fiscalYear},
      ${kind as MilestoneKind},
      ${title},
      ${description},
      ${dueDate}::date
    )
    RETURNING id, kind, title, due_date::text
  `) as Array<{ id: string; kind: string; title: string; due_date: string }>;

  return { ok: true, data: inserted[0] };
}

async function handleUpdateOrganizationFields(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // Only persist fields that were actually provided; leave unset fields
  // untouched so partial captures don't null out prior values.
  const name = typeof input.name === "string" ? input.name.trim() : undefined;
  const entityType =
    typeof input.entity_type === "string" ? input.entity_type.trim() : undefined;
  const samUei =
    typeof input.sam_uei === "string" ? input.sam_uei.trim() : undefined;
  const cageCode =
    typeof input.cage_code === "string" ? input.cage_code.trim() : undefined;
  const scopedSystems =
    typeof input.scoped_systems === "string"
      ? input.scoped_systems.trim()
      : undefined;
  const naicsCodes = Array.isArray(input.naics_codes)
    ? (input.naics_codes as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const sql = getSql();
  // COALESCE pattern: only overwrite when the bound value is non-NULL.
  await sql`
    UPDATE organizations
    SET name = COALESCE(${name ?? null}, name),
        entity_type = COALESCE(${entityType ?? null}, entity_type),
        sam_uei = COALESCE(${samUei ?? null}, sam_uei),
        cage_code = COALESCE(${cageCode ?? null}, cage_code),
        naics_codes = COALESCE(${naicsCodes ?? null}::text[], naics_codes),
        scoped_systems = COALESCE(${scopedSystems ?? null}, scoped_systems),
        updated_at = NOW()
    WHERE id = ${ctx.organizationId}
  `;

  return {
    ok: true,
    data: {
      updated_fields: Object.fromEntries(
        Object.entries({
          name,
          entity_type: entityType,
          sam_uei: samUei,
          cage_code: cageCode,
          naics_codes: naicsCodes,
          scoped_systems: scopedSystems,
        }).filter(([, v]) => v !== undefined),
      ),
    },
  };
}

async function handleUpdateBusinessProfile(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const data = input.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "data must be an object of facts to merge." };
  }
  const scoreRaw = input.completeness_score;
  const score =
    typeof scoreRaw === "number" && scoreRaw >= 0 && scoreRaw <= 100
      ? Math.round(scoreRaw)
      : 0;

  const existing = await getBusinessProfile(ctx.organizationId);
  const merged = {
    ...(existing?.data ?? {}),
    ...(data as Record<string, unknown>),
  };
  await updateBusinessProfile(ctx.organizationId, merged, score, "ai");

  return {
    ok: true,
    data: {
      merged_keys: Object.keys(data as Record<string, unknown>),
      completeness_score: score,
      ready_for_workspace: score >= 40,
    },
  };
}

const ARTIFACT_FORMAT_MIME: Record<string, string> = {
  csv: "text/csv",
  markdown: "text/markdown",
  text: "text/plain",
  pdf: "application/pdf",
};

const ARTIFACT_FORMAT_EXT: Record<string, string> = {
  csv: ".csv",
  markdown: ".md",
  text: ".txt",
  pdf: ".pdf",
};

/**
 * Fill in ONE intake-quiz answer on the user's behalf. Used by the "Help me
 * pick this one" button + by Charlie's natural-language intake-driving turns.
 *
 * audit:tenant-scoping — scopes via ctx.activeAssessmentId + getAssessmentForUser.
 */
async function handleSetIntakeAnswer(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!ctx.activeAssessmentId || !ctx.activeControlId) {
    return {
      ok: false,
      error:
        "set_intake_answer only works when the user is on a /controls/:controlId page.",
    };
  }
  const questionId =
    typeof input.question_id === "string" ? input.question_id.trim() : "";
  const value = typeof input.value === "string" ? input.value.trim() : "";
  if (!questionId) return { ok: false, error: "question_id is required." };
  if (!value) return { ok: false, error: "value is required." };

  const spec = getPracticeSpec(ctx.activeControlId);
  if (!spec?.intake) {
    return {
      ok: false,
      error: `Practice ${ctx.activeControlId} does not have an intake quiz.`,
    };
  }
  const question = spec.intake.questions.find((q) => q.id === questionId);
  if (!question) {
    return {
      ok: false,
      error: `Unknown question_id '${questionId}'. Valid questions for this practice: ${spec.intake.questions
        .map((q) => q.id)
        .join(", ")}.`,
    };
  }
  const validOption = question.options.find((o) => o.value === value);
  if (!validOption) {
    return {
      ok: false,
      error: `Invalid value '${value}' for question '${questionId}'. Allowed values: ${question.options
        .map((o) => `${o.value} (${o.label})`)
        .join("; ")}.`,
    };
  }

  const assessmentCtx = await getAssessmentForUser(
    ctx.activeAssessmentId,
    ctx.userId,
  );
  if (!assessmentCtx) {
    return { ok: false, error: "Assessment not found or you don't have access." };
  }

  await saveIntakeStep(
    ctx.activeAssessmentId,
    ctx.activeControlId,
    questionId,
    value,
  );

  // Re-read current answers so we can tell Charlie what's left.
  const sql = getSql();
  const rows = (await sql`
    SELECT intake_answers
    FROM practice_conversations
    WHERE assessment_id = ${ctx.activeAssessmentId}
      AND control_id = ${ctx.activeControlId}
    LIMIT 1
  `) as Array<{ intake_answers: Record<string, string> | null }>;
  const current = rows[0]?.intake_answers ?? {};

  const remaining = spec.intake.questions
    .filter((q) => !current[q.id])
    .map((q) => ({
      question_id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({
        value: o.value,
        label: o.label,
        description: o.description ?? null,
      })),
    }));

  revalidatePath(
    `/assessments/${ctx.activeAssessmentId}/controls/${ctx.activeControlId}`,
  );

  return {
    ok: true,
    data: {
      saved: { question_id: questionId, value, label: validOption.label },
      remaining_questions: remaining,
      intake_complete: remaining.length === 0,
      message:
        remaining.length === 0
          ? "All intake questions are answered. The user can click 'Finish' on the quiz card — OR you can proceed to auto-draft every required generable artifact right now."
          : `Saved. ${remaining.length} intake question${remaining.length === 1 ? "" : "s"} remaining.`,
    },
  };
}

/**
 * Charlie generates a real evidence artifact from facts captured in the
 * conversation. The artifact is stored in blob storage, inserted as an
 * `evidence_artifacts` row, tagged to the active practice + the slot's
 * `satisfies` objectives, and pre-marked `sufficient` so it counts toward
 * the verdict immediately. The user can replace it any time by uploading
 * their own version to the same slot.
 *
 * Mirrors the safety checks from `uploadEvidenceAction` (size cap, MIME
 * allowlist, audit log) — but skips the user-uploaded reality check because
 * Charlie composes only from the verified transcript.
 */
async function handleGenerateEvidenceArtifact(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via ctx.activeAssessmentId resolved
  // from the user's current page; downstream insertEvidence enforces ownership.
  if (!ctx.activeAssessmentId || !ctx.activeControlId) {
    return {
      ok: false,
      error:
        "generate_evidence_artifact only works when the user is on a /controls/:controlId page.",
    };
  }
  const slotKey = typeof input.slot_key === "string" ? input.slot_key.trim() : "";
  const filename = typeof input.filename === "string" ? input.filename.trim() : "";
  const format = typeof input.format === "string" ? input.format.trim() : "";
  const content = typeof input.content === "string" ? input.content : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";

  if (!slotKey) return { ok: false, error: "slot_key is required." };
  if (!filename) return { ok: false, error: "filename is required." };
  if (!format || !ARTIFACT_FORMAT_MIME[format])
    return {
      ok: false,
      error: "format must be 'pdf', 'csv', 'markdown', or 'text'.",
    };
  if (!content) return { ok: false, error: "content is required." };
  if (content.length > 200_000)
    return { ok: false, error: "content too large (200 KB max)." };
  if (!summary) return { ok: false, error: "summary is required." };

  const spec = getPracticeSpec(ctx.activeControlId);
  if (!spec) {
    return {
      ok: false,
      error: `Practice ${ctx.activeControlId} is not in the hybrid flow yet.`,
    };
  }
  // Bug 3 fix: validate slot_key against the PERSONALIZED spec, not the
  // base spec. Practices like AC.L1-3.1.1 add dynamic slots (e.g.
  // `byod_acknowledgement_register`) based on the user's intake answers.
  // If we validate against the base 5-slot spec, Charlie's
  // generate_evidence_artifact call for a dynamic slot is rejected with
  // "Unknown slot_key" — and the user sees Charlie refuse to draft an
  // artifact for a slot that is clearly visible on the page.
  let effectiveSpec: typeof spec = spec;
  try {
    const sql = getSql();
    const intakeRows = (await sql`
      SELECT intake_answers
      FROM practice_conversations
      WHERE assessment_id = ${ctx.activeAssessmentId}
        AND control_id = ${ctx.activeControlId}
      LIMIT 1
    `) as Array<{ intake_answers: Record<string, string> | null }>;
    const intake = intakeRows[0]?.intake_answers ?? null;
    const personalized = personalizeSpec(spec, intake);
    if (personalized) effectiveSpec = personalized;
  } catch (err) {
    // Personalization is a refinement; if the lookup fails we fall back
    // to the base spec rather than blocking the tool call.
    console.warn("[generate_evidence_artifact] personalize lookup failed", err);
  }
  const slot = effectiveSpec.evidenceSlots.find((s) => s.key === slotKey);
  if (!slot) {
    return {
      ok: false,
      error: `Unknown slot_key '${slotKey}' for ${effectiveSpec.controlId}. Valid slots: ${effectiveSpec.evidenceSlots.map((s) => s.key).join(", ")}.`,
    };
  }

  // Verify the user owns the assessment.
  const assessmentCtx = await getAssessmentForUser(
    ctx.activeAssessmentId,
    ctx.userId,
  );
  if (!assessmentCtx) {
    return { ok: false, error: "Active assessment not accessible." };
  }

  const stored = await storeCharlieArtifact({
    assessmentId: ctx.activeAssessmentId,
    controlId: ctx.activeControlId,
    userId: ctx.userId,
    organizationName: assessmentCtx.organization.name,
    spec,
    slotKey,
    slotSatisfies: slot.satisfies,
    filename,
    format,
    content,
    summary,
  });

  return {
    ok: true,
    data: {
      artifact_id: stored.artifactId,
      filename: stored.filename,
      slot_key: slotKey,
      satisfies_objectives: slot.satisfies,
      message: `Created '${stored.filename}' in the evidence vault and tagged it to objectives [${slot.satisfies.join(", ")}].`,
    },
  };
}

/**
 * Shared evidence-artifact storage pipeline. Used by both the
 * `generate_evidence_artifact` tool (Charlie composing in-chat) and the
 * `draftSlotArtifactAction` server action (one-click inline draft). Handles
 * filename normalization, optional PDF rendering, blob upload, DB insert,
 * and objective tagging. Returns the stored filename + artifact id.
 */
export async function storeCharlieArtifact(args: {
  assessmentId: string;
  controlId: string;
  userId: string;
  organizationName: string;
  spec: { controlId: string; shortName: string };
  slotKey: string;
  slotSatisfies: string[];
  filename: string;
  format: string;
  content: string;
  summary: string;
}): Promise<{ artifactId: string; filename: string }> {
  const ext = ARTIFACT_FORMAT_EXT[args.format];
  const baseName = args.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const baseNoExt = baseName.replace(/\.(md|markdown|txt|csv|pdf)$/i, "");
  const withExt = `${baseNoExt}${ext}`;
  const finalName = `[slot:${args.slotKey}]__${withExt}`;
  const mime = ARTIFACT_FORMAT_MIME[args.format];

  let body: Buffer | string;
  let sizeBytes: number;
  if (args.format === "pdf") {
    const { renderDeliverablePdf } = await import(
      "@/lib/cmmc/pdf-deliverable"
    );
    const h1 = /^\s*#\s+(.+)$/m.exec(args.content);
    const derivedTitle = h1
      ? h1[1].trim()
      : baseNoExt
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
    body = await renderDeliverablePdf({
      meta: {
        organizationName: args.organizationName,
        title: derivedTitle,
        subtitle: args.summary,
        controlId: args.spec.controlId,
        controlTitle: args.spec.shortName,
        effectiveDate: new Date(),
        documentType: "EVIDENCE DELIVERABLE",
      },
      body: h1 ? args.content.replace(h1[0], "").trimStart() : args.content,
    });
    sizeBytes = body.length;
  } else {
    body = args.content;
    sizeBytes = Buffer.byteLength(args.content, "utf8");
  }

  const pathname = `evidence/${args.assessmentId}/${args.controlId}/${Date.now()}-charlie-${finalName}`;
  const blob = await put(pathname, body, {
    access: "private",
    addRandomSuffix: true,
    contentType: mime,
  });

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO evidence_artifacts
      (assessment_id, control_id, filename, blob_url, mime_type,
       size_bytes, uploaded_by_user_id,
       ai_review_verdict, ai_review_summary, ai_review_mapped_controls,
       ai_reviewed_at, ai_review_model)
    VALUES
      (${args.assessmentId}, ${args.controlId}, ${finalName},
       ${blob.url}, ${mime}, ${sizeBytes},
       ${args.userId},
       'sufficient', ${args.summary},
       ${[args.controlId]},
       NOW(), 'charlie-generated')
    RETURNING id
  `) as Array<{ id: string }>;
  const artifactId = inserted[0].id;

  await tagArtifactPractice({
    artifactId,
    assessmentId: args.assessmentId,
    controlId: args.controlId,
    objectives: args.slotSatisfies,
    userId: args.userId,
  });

  return { artifactId, filename: finalName };
}

async function handleEscalateToOfficer(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // Officer escalations require the `custodia_officer` feature. The Self
  // Service ($149) plan doesn't grant it; in that case we don't insert a
  // ticket — we hand back a message Charlie can use to point the user at
  // the $297 upgrade or a security-consulting engagement.
  const { auth } = await import("@clerk/nextjs/server");
  const { hasOfficerFeature } = await import("@/lib/billing/plans");
  const { has } = await auth();
  if (!hasOfficerFeature(has)) {
    return {
      ok: false,
      error:
        "Officer tickets aren't on this account's plan. Tell the user: \"Live tickets with a human Custodia Compliance Officer are part of the Self Service + Custodia Officer plan ($297/mo). On Self Service ($149/mo) I'll keep helping here, but for written officer help — or anything past CMMC L1 like L2/DFARS, FedRAMP, or audit defense — they can upgrade at /upgrade?plan=bidfedcmmc_self_service_custodia_officer_ or email officers@custodia.us for scoped security consulting.\"",
    };
  }

  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const urgency =
    typeof input.urgency === "string" &&
    (escalationUrgencies as readonly string[]).includes(input.urgency)
      ? (input.urgency as EscalationUrgency)
      : "routine";

  if (!topic) return { ok: false, error: "topic is required." };
  if (!summary) return { ok: false, error: "summary is required." };

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO officer_escalations
      (organization_id, conversation_id, topic, urgency, summary)
    VALUES (
      ${ctx.organizationId}::uuid,
      ${ctx.conversationId}::uuid,
      ${topic},
      ${urgency},
      ${summary}
    )
    RETURNING id, topic, urgency, status, created_at
  `) as Array<{
    id: string;
    topic: string;
    urgency: string;
    status: string;
    created_at: string;
  }>;

  return {
    ok: true,
    data: {
      ...inserted[0],
      officer_note:
        "A Custodia officer has been notified. Typical response: 1 business day for routine, 4h for priority, 1h for urgent.",
    },
  };
}

async function handleCiteRegulation(
  input: Record<string, unknown>,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — static regulation lookup, no tenant data.
  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (!key) return { ok: false, error: "key is required." };

  const citation = lookupCitation(key);
  if (!citation) {
    return {
      ok: false,
      error: `Unknown citation key '${key}'. Valid control ids: ${Object.keys(controlCitations).join(", ")}. Valid framework slugs: ${Object.keys(frameworkCitations).join(", ")}.`,
    };
  }
  return { ok: true, data: citation };
}

/**
 * Pull the org's stored NAICS codes — used as the default search basis when
 * the user asks the AI to find opportunities without specifying NAICS.
 */
async function getOrgNaics(organizationId: string): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT naics_codes FROM organizations WHERE id = ${organizationId}
  `) as Array<{ naics_codes: string[] | null }>;
  return rows[0]?.naics_codes ?? [];
}

function summarizeOpportunity(o: SamOpportunity) {
  return {
    notice_id: o.noticeId,
    title: o.title,
    department: o.department,
    sub_tier: o.subTier,
    office: o.office,
    type: o.type,
    naics_code: o.naicsCode,
    set_aside: o.setAside,
    response_deadline: o.responseDeadline,
    posted_date: o.postedDate,
    sam_url: o.samUrl,
    description_excerpt:
      o.description && o.description.length > 600
        ? o.description.slice(0, 600) + "…"
        : o.description,
  };
}

async function handleSearchSamOpportunities(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const apiKey = process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "SAM.gov live search isn't configured on this server (missing SAM_GOV_API_KEY). The user should still see their weekly digest in /opportunities — direct them there.",
    };
  }

  const naicsArg = Array.isArray(input.naics_codes)
    ? (input.naics_codes as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : null;
  // null = caller didn't pass the field → use org default; [] = explicit "no NAICS filter"
  const naicsCodes =
    naicsArg === null ? await getOrgNaics(ctx.organizationId) : naicsArg;

  const keyword = typeof input.keyword === "string" ? input.keyword : undefined;
  const setAside = typeof input.set_aside === "string" ? input.set_aside : undefined;
  const postedFromDays =
    typeof input.posted_within_days === "number" ? input.posted_within_days : undefined;
  const limit = typeof input.limit === "number" ? input.limit : undefined;

  try {
    const results = await searchSamOpportunities({
      apiKey,
      naicsCodes,
      keyword,
      setAside,
      postedFromDays,
      limit,
    });

    return {
      ok: true,
      data: {
        query: {
          naics_codes: naicsCodes,
          keyword: keyword ?? null,
          set_aside: setAside ?? null,
          posted_within_days: postedFromDays ?? 14,
          limit: limit ?? 25,
        },
        used_org_naics: naicsArg === null,
        result_count: results.length,
        results: results.map(summarizeOpportunity),
      },
    };
  } catch (err) {
    if (err instanceof SamApiKeyError) {
      return {
        ok: false,
        error:
          "SAM.gov rejected the platform API key. The Custodia team has been alerted; live search is temporarily unavailable. Please tell the user we'll have it back online shortly.",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `SAM.gov search failed: ${msg}` };
  }
}

async function handleListInboxOpportunities(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const includeDismissed = input.include_dismissed === true;
  const rawLimit = typeof input.limit === "number" ? input.limit : 25;
  const limit = Math.min(Math.max(rawLimit, 1), 100);

  const rows = await listOpportunitiesForOrg({
    organizationId: ctx.organizationId,
    includeDismissed,
    limit,
  });

  return {
    ok: true,
    data: {
      count: rows.length,
      include_dismissed: includeDismissed,
      opportunities: rows.map((r) => ({
        inbox_id: r.id,
        notice_id: r.notice_id,
        title: r.title,
        department: r.department,
        naics_code: r.naics_code,
        set_aside: r.set_aside,
        response_deadline: r.response_deadline,
        posted_date: r.posted_date,
        seen_at: r.seen_at,
        viewed_at: r.viewed_at,
        dismissed_at: r.dismissed_at,
        sam_url: r.sam_url,
        description_excerpt:
          r.description && r.description.length > 600
            ? r.description.slice(0, 600) + "…"
            : r.description,
      })),
    },
  };
}

async function handleAnalyzeOpportunityFit(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const noticeId =
    typeof input.notice_id === "string" ? input.notice_id.trim() : "";
  const inboxId =
    typeof input.inbox_id === "string" ? input.inbox_id.trim() : "";

  if (!noticeId && !inboxId) {
    return {
      ok: false,
      error: "Provide notice_id (from search results) or inbox_id (from saved digest).",
    };
  }

  const sql = getSql();
  // Try the inbox first — owned by this org by definition.
  if (inboxId) {
    const rows = (await sql`
      SELECT id, notice_id, title, department, sub_tier, office, type,
             naics_code, set_aside,
             to_char(response_deadline, 'YYYY-MM-DD') AS response_deadline,
             to_char(posted_date, 'YYYY-MM-DD')      AS posted_date,
             sam_url, description, raw, matched_on
      FROM sam_opportunities
      WHERE id = ${inboxId} AND organization_id = ${ctx.organizationId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (rows[0]) {
      return await augmentWithOrgFit(rows[0], ctx);
    }
  }

  // Fall back to a SAM lookup by notice_id, scoped to org's history.
  if (noticeId) {
    const rows = (await sql`
      SELECT id, notice_id, title, department, sub_tier, office, type,
             naics_code, set_aside,
             to_char(response_deadline, 'YYYY-MM-DD') AS response_deadline,
             to_char(posted_date, 'YYYY-MM-DD')      AS posted_date,
             sam_url, description, raw, matched_on
      FROM sam_opportunities
      WHERE notice_id = ${noticeId} AND organization_id = ${ctx.organizationId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (rows[0]) {
      return await augmentWithOrgFit(rows[0], ctx);
    }
    // Last resort: fetch live from SAM (rare — happens when AI is analyzing
    // a fresh search-result it hasn't saved yet).
    return {
      ok: false,
      error: `Opportunity ${noticeId} isn't in this org's inbox yet. Tell the user to open it from the Monday digest or run search_sam_opportunities again — that returns the same fields.`,
    };
  }

  return { ok: false, error: "No matching opportunity found." };
}

async function augmentWithOrgFit(
  row: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const naics = await getOrgNaics(ctx.organizationId);
  const profile = await getBusinessProfile(ctx.organizationId);

  return {
    ok: true,
    data: {
      opportunity: row,
      org_context: {
        naics_codes: naics,
        business_profile_completeness: profile?.completeness_score ?? 0,
        business_profile_keys: Object.keys(profile?.data ?? {}),
      },
      analysis_hint:
        "Compare opportunity.naics_code against org_context.naics_codes (exact match strongest). Flag deadline urgency (<7 days = tight, <3 days = walk-away unless we already have evidence). Cross-reference set_aside against any socioeconomic certifications you've captured in business_profile. Then state plainly: GO / MAYBE / SKIP, with the top 2 reasons for each.",
    },
  };
}

async function handleDismissOpportunity(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const inboxId =
    typeof input.inbox_id === "string" ? input.inbox_id.trim() : "";
  if (!inboxId) return { ok: false, error: "inbox_id is required." };

  await dismissOpportunity({
    organizationId: ctx.organizationId,
    opportunityId: inboxId,
  });

  return {
    ok: true,
    data: {
      inbox_id: inboxId,
      dismissed: true,
      reversible_in: "/opportunities (toggle 'Show dismissed').",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope inventory tools (32 CFR § 170.19) — used during the scope step so
// Charlie can drop People / Technology / Facility / ESP / Specialized Asset
// rows directly into the org's inventory while interviewing the user. The
// scope page listens for `custodia:scope-changed` window events fired from
// the rail's `tool_end` dispatch and refreshes itself.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_SCOPE_KIND_LABELS: Record<"people" | "technology" | "facility", string> = {
  people: "People",
  technology: "Technology",
  facility: "Facility",
};

async function handleAddScopeItem(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const kind = typeof input.kind === "string" ? input.kind.trim() : "";
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!label) return { ok: false, error: "label is required." };
  if (kind !== "people" && kind !== "technology" && kind !== "facility") {
    return {
      ok: false,
      error:
        "kind must be one of: people, technology, facility. Use add_esp for ESPs and add_specialized_asset for IoT/OT/GFE.",
    };
  }
  // Belt-and-suspenders: scope_inventory accepts 'esp' too, but we want the
  // dedicated add_esp tool to own that path so contact / attestation fields
  // get captured properly.
  if (!(scopeKinds as readonly string[]).includes(kind)) {
    return { ok: false, error: `Invalid scope kind: ${kind}.` };
  }

  const role = typeof input.role === "string" ? input.role.trim() : null;
  const notes = typeof input.notes === "string" ? input.notes.trim() : null;
  const handlesFci =
    typeof input.handles_fci === "boolean" ? input.handles_fci : true;

  const { row, duplicate } = await addScopeItem({
    organizationId: ctx.organizationId,
    kind: kind as ScopeKind,
    label,
    role: role || null,
    handlesFci,
    notes: notes || null,
  });

  return {
    ok: true,
    data: {
      id: row.id,
      kind: row.kind,
      kind_label: ALLOWED_SCOPE_KIND_LABELS[kind as keyof typeof ALLOWED_SCOPE_KIND_LABELS],
      label: row.label,
      handles_fci: row.handles_fci,
      already_existed: duplicate,
      note: duplicate
        ? "This item was ALREADY in the scope inventory — no duplicate was created. Do not add it again. If the user wanted to change details, call update_scope_item (not available yet) or tell them to edit on the Scope page."
        : undefined,
    },
  };
}

async function handleAddEsp(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "name is required." };

  const str = (k: string): string | null => {
    const v = input[k];
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t : null;
  };

  const { row, duplicate } = await addEsp({
    organizationId: ctx.organizationId,
    name,
    vendor: str("vendor"),
    services: str("services"),
    cmmcStatus: str("cmmc_status"),
    contactEmail: str("contact_email"),
    attestationDocUrl: str("attestation_doc_url"),
  });

  return {
    ok: true,
    data: {
      id: row.id,
      name: row.name,
      vendor: row.vendor,
      cmmc_status: row.cmmc_status,
      already_existed: duplicate,
      note: duplicate
        ? "This ESP was ALREADY registered — no duplicate was created. Do not add it again."
        : undefined,
    },
  };
}

async function handleAddSpecializedAsset(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const assetType =
    typeof input.asset_type === "string" ? input.asset_type.trim() : "";
  if (!label) return { ok: false, error: "label is required." };
  if (!(specializedAssetTypes as readonly string[]).includes(assetType)) {
    return {
      ok: false,
      error: `asset_type must be one of: ${specializedAssetTypes.join(", ")}.`,
    };
  }

  const description =
    typeof input.description === "string" ? input.description.trim() : null;
  const handlesFci =
    typeof input.handles_fci === "boolean" ? input.handles_fci : true;

  const { row, duplicate } = await addSpecializedAsset({
    organizationId: ctx.organizationId,
    label,
    assetType: assetType as SpecializedAssetType,
    description: description || null,
    handlesFci,
  });

  return {
    ok: true,
    data: {
      id: row.id,
      label: row.label,
      asset_type: row.asset_type,
      handles_fci: row.handles_fci,
      already_existed: duplicate,
      note: duplicate
        ? "This specialized asset was ALREADY in the inventory — no duplicate was created. Do not add it again."
        : undefined,
    },
  };
}

async function handleReadScopeInventoryState(
  ctx: ToolContext,
): Promise<ToolResult> {
  const [scope, esps, specialized] = await Promise.all([
    listScopeItems(ctx.organizationId),
    listEsps(ctx.organizationId),
    listSpecializedAssets(ctx.organizationId),
  ]);
  return {
    ok: true,
    data: {
      people: scope
        .filter((s) => s.kind === "people")
        .map((s) => ({ label: s.label, role: s.role, handles_fci: s.handles_fci })),
      technology: scope
        .filter((s) => s.kind === "technology")
        .map((s) => ({ label: s.label, role: s.role, handles_fci: s.handles_fci })),
      facility: scope
        .filter((s) => s.kind === "facility")
        .map((s) => ({ label: s.label, role: s.role, handles_fci: s.handles_fci })),
      esps: esps.map((e) => ({
        name: e.name,
        vendor: e.vendor,
        cmmc_status: e.cmmc_status,
        services: e.services,
      })),
      specialized_assets: specialized.map((a) => ({
        label: a.label,
        asset_type: a.asset_type,
        handles_fci: a.handles_fci,
      })),
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// FCI Boundary tools
// ────────────────────────────────────────────────────────────────────

async function loadOrgLegalEntity(organizationId: string): Promise<{
  id: string;
  name: string;
  cage: string | null;
  uei: string | null;
  naics: string[];
}> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, cage_code, sam_uei, naics_codes
    FROM organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `) as Array<{
    id: string;
    name: string;
    cage_code: string | null;
    sam_uei: string | null;
    naics_codes: string[] | null;
  }>;
  const r = rows[0];
  return {
    id: r?.id ?? organizationId,
    name: r?.name ?? "",
    cage: r?.cage_code ?? null,
    uei: r?.sam_uei ?? null,
    naics: r?.naics_codes ?? [],
  };
}

async function handleReadBoundaryState(ctx: ToolContext): Promise<ToolResult> {
  const legalEntity = await loadOrgLegalEntity(ctx.organizationId);
  const view = await assembleBoundaryView({
    organizationId: ctx.organizationId,
    legalEntity,
  });
  const findings = validateBoundary(view);
  const counts = findingCounts(findings);
  return {
    ok: true,
    data: {
      legal_entity: view.legal_entity,
      counts: {
        people: view.people.length,
        technology: view.technology.length,
        facilities: view.facilities.length,
        esps: view.esps.length + view.scope_inventory_esps.length,
        flows_inbound: view.flows.filter((f) => f.direction === "inbound").length,
        flows_outbound: view.flows.filter((f) => f.direction === "outbound").length,
        flows_internal: view.flows.filter((f) => f.direction === "internal").length,
        out_of_scope: view.out_of_scope.length,
      },
      affirming_official: view.affirming_official,
      narrative: view.narrative,
      ready_for_ssp: isReadyForSsp(findings),
      findings_summary: counts,
      findings: findings.map((f) => ({
        level: f.level,
        code: f.code,
        message: f.message,
        control_refs: f.control_refs ?? [],
      })),
    },
  };
}

async function handleSetAffirmingOfficial(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!name) return { ok: false, error: "name is required." };
  if (!title) return { ok: false, error: "title is required." };
  if (!email) return { ok: false, error: "email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "email must be a valid email address." };
  }

  const ao: AffirmingOfficial = {
    name,
    title,
    email,
    acknowledged_at: null, // user re-acknowledges in the workspace UI
  };
  await patchScopeProfile(ctx.organizationId, { affirming_official: ao });
  return {
    ok: true,
    data: {
      name: ao.name,
      title: ao.title,
      email: ao.email,
      acknowledged_at: null,
      next_step:
        "The affirming official must visit /assessments/boundary and click 'Acknowledge boundary' before SSP generation is unlocked.",
    },
  };
}

async function handleAddFciFlow(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const direction = typeof input.direction === "string" ? input.direction : "";
  const channel = typeof input.channel === "string" ? input.channel : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const counterparty =
    typeof input.counterparty === "string" && input.counterparty.trim()
      ? input.counterparty.trim()
      : null;

  const validDirections: FlowDirection[] = ["inbound", "outbound", "internal"];
  if (!(validDirections as string[]).includes(direction)) {
    return {
      ok: false,
      error: `direction must be one of: ${validDirections.join(", ")}.`,
    };
  }
  const validChannels: FlowChannel[] = [
    "prime_portal",
    "email",
    "sftp",
    "api",
    "removable_media",
    "paper",
    "internal_sync",
    "other",
  ];
  if (!(validChannels as string[]).includes(channel)) {
    return {
      ok: false,
      error: `channel must be one of: ${validChannels.join(", ")}.`,
    };
  }
  if (!description) {
    return { ok: false, error: "description is required." };
  }

  const flow: ScopeFlow = {
    id: randomUUID(),
    direction: direction as FlowDirection,
    channel: channel as FlowChannel,
    description,
    counterparty,
    touches_scope_item_ids: [],
  };

  const current = await getScopeProfile(ctx.organizationId);
  await patchScopeProfile(ctx.organizationId, {
    flows: [...current.flows, flow],
  });
  return {
    ok: true,
    data: {
      id: flow.id,
      direction: flow.direction,
      channel: flow.channel,
      description: flow.description,
      counterparty: flow.counterparty,
    },
  };
}

async function handleAddOutOfScopeItem(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const asset = typeof input.asset === "string" ? input.asset.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const segregation =
    typeof input.segregation === "string" ? input.segregation.trim() : "";
  if (!asset) return { ok: false, error: "asset is required." };
  if (!reason) return { ok: false, error: "reason is required." };
  if (!segregation) {
    return { ok: false, error: "segregation rationale is required." };
  }

  const item: OutOfScopeItem = {
    id: randomUUID(),
    asset,
    reason,
    segregation,
  };
  const current = await getScopeProfile(ctx.organizationId);
  await patchScopeProfile(ctx.organizationId, {
    out_of_scope: [...current.out_of_scope, item],
  });
  return {
    ok: true,
    data: {
      id: item.id,
      asset: item.asset,
      reason: item.reason,
      segregation: item.segregation,
    },
  };
}

// ---------- Tier 1.1: set_objective_status ----------

const OBJECTIVE_LETTERS = new Set(["a", "b", "c", "d", "e", "f"]);

async function handleSetObjectiveStatus(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via ctx.userId + getAssessmentForUser
  const controlIdRaw =
    typeof input.control_id === "string" ? input.control_id.trim() : "";
  const letterRaw =
    typeof input.letter === "string" ? input.letter.trim().toLowerCase() : "";
  const statusRaw =
    typeof input.status === "string" ? input.status.trim().toUpperCase() : "";
  const rationaleRaw =
    typeof input.rationale === "string" ? input.rationale.trim() : "";

  if (!controlIdRaw) return { ok: false, error: "control_id is required." };
  if (!legacyToRequirement[controlIdRaw]) {
    return {
      ok: false,
      error: `Unknown control_id '${controlIdRaw}'. Must be one of the 15 CMMC L1 practices (e.g. AC.L1-3.1.1).`,
    };
  }
  if (!OBJECTIVE_LETTERS.has(letterRaw)) {
    return { ok: false, error: "letter must be one of: a, b, c, d, e, f." };
  }
  const objectives = practiceObjectives[controlIdRaw] ?? [];
  const objective = objectives.find((o) => o.letter === letterRaw);
  if (!objective) {
    return {
      ok: false,
      error: `Practice ${controlIdRaw} has no objective '${letterRaw}'. Valid letters: ${objectives.map((o) => o.letter).join(", ")}.`,
    };
  }
  if (!["MET", "NOT_MET", "NA", "EE", "TD"].includes(statusRaw)) {
    return {
      ok: false,
      error: "status must be one of: MET, NOT_MET, NA, EE, TD.",
    };
  }
  if (rationaleRaw.length < 20) {
    return {
      ok: false,
      error:
        "rationale must be at least 20 characters — write a real justification the user (and a future 3PAO) can read.",
    };
  }

  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) {
    return { ok: false, error: "No assessment found for this org." };
  }
  const assessment = await getAssessmentForUser(assessmentId, ctx.userId);
  if (!assessment) {
    return {
      ok: false,
      error: "You don't have access to that assessment.",
    };
  }

  // Make sure the per-objective rows exist before UPSERT.
  await seedObjectiveRows(assessmentId);

  let update: Parameters<typeof setObjectiveResponse>[0]["update"];
  let appliedStatus: string;
  switch (statusRaw) {
    case "MET":
      update = {
        status: "met",
        narrative: rationaleRaw,
        exceptionType: null,
        exceptionNotes: null,
      };
      appliedStatus = "met";
      break;
    case "NOT_MET":
      update = {
        status: "not_met",
        narrative: rationaleRaw,
        exceptionType: null,
        exceptionNotes: null,
      };
      appliedStatus = "not_met";
      break;
    case "NA":
      update = {
        status: "not_applicable",
        naJustification: rationaleRaw,
        exceptionType: null,
        exceptionNotes: null,
      };
      appliedStatus = "not_applicable";
      break;
    case "EE":
      update = {
        status: "not_met",
        exceptionType: "enduring",
        exceptionNotes: rationaleRaw,
      };
      appliedStatus = "met (rolled up from enduring exception)";
      break;
    case "TD":
      update = {
        status: "not_met",
        exceptionType: "temporary",
        exceptionNotes: rationaleRaw,
      };
      appliedStatus =
        "met (rolled up from temporary deficiency — pair with propose_milestone)";
      break;
    default:
      return { ok: false, error: "unreachable status" };
  }

  await setObjectiveResponse({
    assessmentId,
    controlId: controlIdRaw,
    objectiveLetter: letterRaw,
    update,
  });

  return {
    ok: true,
    data: {
      assessment_id: assessmentId,
      control_id: controlIdRaw,
      letter: letterRaw,
      status: statusRaw,
      applied: appliedStatus,
      objective_ask: objective.ask,
    },
  };
}

// ---------- Tier 1.2: remove tools ----------

async function handleRemoveScopeItem(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return { ok: false, error: "id is required." };
  const items = await listScopeItems(ctx.organizationId);
  const existing = items.find((i) => i.id === id);
  if (!existing) {
    return {
      ok: false,
      error: "scope item not found (already removed or wrong id).",
    };
  }
  await retireScopeItem(id, ctx.organizationId);
  return {
    ok: true,
    data: {
      id,
      label: existing.label,
      kind: existing.kind,
      retired: true,
    },
  };
}

async function handleRemoveEsp(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return { ok: false, error: "id is required." };
  const items = await listEsps(ctx.organizationId);
  const existing = items.find((i) => i.id === id);
  if (!existing) {
    return { ok: false, error: "ESP not found (already removed or wrong id)." };
  }
  await deleteEsp(id, ctx.organizationId);
  return {
    ok: true,
    data: { id, name: existing.name, deleted: true },
  };
}

async function handleRemoveSpecializedAsset(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return { ok: false, error: "id is required." };
  const items = await listSpecializedAssets(ctx.organizationId);
  const existing = items.find((i) => i.id === id);
  if (!existing) {
    return {
      ok: false,
      error: "specialized asset not found (already removed or wrong id).",
    };
  }
  await deleteSpecializedAsset(id, ctx.organizationId);
  return {
    ok: true,
    data: {
      id,
      label: existing.label,
      asset_type: existing.asset_type,
      deleted: true,
    },
  };
}

// ---------- Tier 1.3: update tools ----------

function strPatch(input: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in input)) return undefined;
  const v = input[key];
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : null;
}

async function handleUpdateScopeItem(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return { ok: false, error: "id is required." };
  const items = await listScopeItems(ctx.organizationId);
  const existing = items.find((i) => i.id === id);
  if (!existing) return { ok: false, error: "scope item not found." };

  const labelPatch = strPatch(input, "label");
  const rolePatch = strPatch(input, "role");
  const notesPatch = strPatch(input, "notes");
  const handlesFciPatch =
    typeof input.handles_fci === "boolean" ? input.handles_fci : undefined;

  const nextLabel = labelPatch === undefined ? existing.label : (labelPatch ?? existing.label);
  if (!nextLabel) return { ok: false, error: "label cannot be cleared to empty." };

  await updateScopeItem({
    id,
    organizationId: ctx.organizationId,
    label: nextLabel,
    role: rolePatch === undefined ? existing.role : rolePatch,
    handlesFci: handlesFciPatch === undefined ? existing.handles_fci : handlesFciPatch,
    notes: notesPatch === undefined ? existing.notes : notesPatch,
  });

  return {
    ok: true,
    data: {
      id,
      label: nextLabel,
      kind: existing.kind,
      handles_fci:
        handlesFciPatch === undefined ? existing.handles_fci : handlesFciPatch,
      updated: true,
    },
  };
}

async function handleUpdateEspTool(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return { ok: false, error: "id is required." };
  const items = await listEsps(ctx.organizationId);
  const existing = items.find((i) => i.id === id);
  if (!existing) return { ok: false, error: "ESP not found." };

  const namePatch = strPatch(input, "name");
  const nextName = namePatch === undefined ? existing.name : (namePatch ?? existing.name);
  if (!nextName) return { ok: false, error: "name cannot be cleared to empty." };

  const vendorPatch = strPatch(input, "vendor");
  const servicesPatch = strPatch(input, "services");
  const cmmcStatusPatch = strPatch(input, "cmmc_status");
  const attestationPatch = strPatch(input, "attestation_doc_url");
  const contactPatch = strPatch(input, "contact_email");

  await updateEsp({
    id,
    organizationId: ctx.organizationId,
    name: nextName,
    vendor: vendorPatch === undefined ? existing.vendor : vendorPatch,
    services: servicesPatch === undefined ? existing.services : servicesPatch,
    cmmcStatus:
      cmmcStatusPatch === undefined ? existing.cmmc_status : cmmcStatusPatch,
    attestationDocUrl:
      attestationPatch === undefined
        ? existing.attestation_doc_url
        : attestationPatch,
    contactEmail:
      contactPatch === undefined ? existing.contact_email : contactPatch,
  });

  return {
    ok: true,
    data: {
      id,
      name: nextName,
      cmmc_status:
        cmmcStatusPatch === undefined ? existing.cmmc_status : cmmcStatusPatch,
      updated: true,
    },
  };
}

async function handleUpdateSpecializedAssetTool(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return { ok: false, error: "id is required." };
  const items = await listSpecializedAssets(ctx.organizationId);
  const existing = items.find((i) => i.id === id);
  if (!existing) return { ok: false, error: "specialized asset not found." };

  const labelPatch = strPatch(input, "label");
  const nextLabel = labelPatch === undefined ? existing.label : (labelPatch ?? existing.label);
  if (!nextLabel) return { ok: false, error: "label cannot be cleared to empty." };

  let nextAssetType: SpecializedAssetType = existing.asset_type;
  if (typeof input.asset_type === "string") {
    const candidate = input.asset_type.trim();
    if (!(specializedAssetTypes as readonly string[]).includes(candidate)) {
      return {
        ok: false,
        error: `asset_type must be one of: ${specializedAssetTypes.join(", ")}.`,
      };
    }
    nextAssetType = candidate as SpecializedAssetType;
  }
  const descriptionPatch = strPatch(input, "description");
  const handlesFciPatch =
    typeof input.handles_fci === "boolean" ? input.handles_fci : undefined;

  await updateSpecializedAsset({
    id,
    organizationId: ctx.organizationId,
    label: nextLabel,
    assetType: nextAssetType,
    description:
      descriptionPatch === undefined ? existing.description : descriptionPatch,
    handlesFci:
      handlesFciPatch === undefined ? existing.handles_fci : handlesFciPatch,
  });

  return {
    ok: true,
    data: {
      id,
      label: nextLabel,
      asset_type: nextAssetType,
      updated: true,
    },
  };
}

// ---------- Tier 1.4: next_best_action ----------

async function handleNextBestAction(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — every fetch below is scoped via
  // ctx.organizationId or via assessmentId resolved from ctx.userId.
  const orgId = ctx.organizationId;

  const [profile, scopeItems, esps, specialAssets, scopeProfile, opps, samRows] =
    await Promise.all([
      getBusinessProfile(orgId),
      listScopeItems(orgId),
      listEsps(orgId),
      listSpecializedAssets(orgId),
      getScopeProfile(orgId),
      listOpportunitiesForOrg({ organizationId: orgId, limit: 5 }),
      (async () => {
        const sql = getSql();
        const rows = (await sql`
          SELECT sam_uei FROM organizations WHERE id = ${orgId}
        `) as Array<{ sam_uei: string | null }>;
        return rows[0]?.sam_uei ?? null;
      })(),
    ]);

  const assessmentId = await resolveAssessmentId(input, ctx);
  let objectives: ObjectiveResponseRow[] = [];
  if (assessmentId) {
    const assessment = await getAssessmentForUser(assessmentId, ctx.userId);
    if (assessment) {
      await seedObjectiveRows(assessmentId);
      objectives = await listObjectivesForAssessment(assessmentId);
    }
  }

  const blockers: Array<{ section: string; reason: string; route: string }> = [];

  const profileScore = profile?.completeness_score ?? 0;
  if (profileScore < 40) {
    blockers.push({
      section: "business_profile",
      reason:
        "Business profile is below 40% complete — the AI needs basic context (what you do, where, who you serve) before it can tailor anything.",
      route: "/onboard",
    });
  }

  if (!samRows) {
    blockers.push({
      section: "sam_registration",
      reason:
        "SAM.gov UEI is missing. Federal primes require an active SAM registration before contract award.",
      route: "/admin/sam",
    });
  }

  if (scopeItems.length === 0 && esps.length === 0 && specialAssets.length === 0) {
    blockers.push({
      section: "scope_inventory",
      reason:
        "Scope inventory is empty. The 15 L1 practices map to assets — without at least a few people / systems / facilities the boundary is undefined.",
      route: assessmentId ? `/assessments/${assessmentId}/scope` : "/assessments",
    });
  }

  if (!scopeProfile.affirming_official) {
    blockers.push({
      section: "affirming_official",
      reason:
        "No affirming official recorded. Required to submit the annual self-attestation.",
      route: assessmentId ? `/assessments/${assessmentId}/boundary` : "/assessments",
    });
  }

  // Practice progress
  const totalObjectives = objectives.length;
  const answeredObjectives = objectives.filter(
    (o) => o.status !== "unanswered",
  ).length;
  const unmetObjectives = objectives.filter(
    (o) => o.status === "not_met" && !o.exception_type,
  );

  // Composite percent
  const pieces = [
    Math.min(profileScore, 100),
    samRows ? 100 : 0,
    scopeItems.length + esps.length + specialAssets.length > 0 ? 100 : 0,
    scopeProfile.affirming_official ? 100 : 0,
    totalObjectives > 0
      ? Math.round((answeredObjectives / totalObjectives) * 100)
      : 0,
  ];
  const pctComplete = Math.round(pieces.reduce((a, b) => a + b, 0) / pieces.length);

  // Pick the single next step (highest-priority blocker, else next gap)
  let nextStep: { section: string; action: string; route: string; why: string };
  if (blockers.length > 0) {
    const b = blockers[0];
    nextStep = {
      section: b.section,
      action: `Resolve blocker: ${b.section}`,
      route: b.route,
      why: b.reason,
    };
  } else if (unmetObjectives.length > 0) {
    const u = unmetObjectives[0];
    nextStep = {
      section: "practice",
      action: `Grade objective ${u.objective_letter} on ${u.control_id}`,
      route: assessmentId
        ? `/assessments/${assessmentId}/controls/${u.control_id}`
        : "/assessments",
      why: `Objective ${u.control_id}.${u.objective_letter} is NOT_MET with no exception — either remediate, mark EE/TD with rationale, or attach evidence.`,
    };
  } else if (answeredObjectives < totalObjectives) {
    const u = objectives.find((o) => o.status === "unanswered");
    nextStep = {
      section: "practice",
      action: u
        ? `Grade objective ${u.objective_letter} on ${u.control_id}`
        : "Continue grading practices",
      route:
        u && assessmentId
          ? `/assessments/${assessmentId}/controls/${u.control_id}`
          : assessmentId
            ? `/assessments/${assessmentId}`
            : "/assessments",
      why: `${totalObjectives - answeredObjectives} objectives still unanswered.`,
    };
  } else if (opps.length === 0) {
    nextStep = {
      section: "bid_radar",
      action: "Set up bid radar to find matching SAM.gov opportunities",
      route: "/opportunities",
      why: "Once attestation is ready, the next leverage point is sourcing matching contract opportunities.",
    };
  } else {
    nextStep = {
      section: "attestation",
      action: "Submit annual self-attestation",
      route: assessmentId ? `/assessments/${assessmentId}` : "/assessments",
      why: "All blockers cleared and every objective answered — the cycle is ready to attest.",
    };
  }

  // Rough minutes-to-attestation estimate
  const remainingObjectives = Math.max(totalObjectives - answeredObjectives, 0);
  const estMinutes =
    blockers.length * 10 + remainingObjectives * 3 + (samRows ? 0 : 15);

  return {
    ok: true,
    data: {
      pct_complete: pctComplete,
      est_minutes_to_attestation: estMinutes,
      blockers,
      next_step: nextStep,
      counts: {
        scope_items: scopeItems.length,
        esps: esps.length,
        specialized_assets: specialAssets.length,
        objectives_total: totalObjectives,
        objectives_answered: answeredObjectives,
        objectives_unmet_no_exception: unmetObjectives.length,
        opportunities_inbox: opps.length,
      },
    },
  };
}

// ---------- Tier 1.5: navigate_user_to ----------

const NAVIGATE_ALLOWED_PREFIXES = [
  "/onboard",
  "/assessments",
  "/opportunities",
  "/dashboard",
  "/profile",
  "/admin/sam",
];

async function handleNavigateUserTo(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — emits a client-side navigation hint only; no data read or written.
  const raw = typeof input.path === "string" ? input.path.trim() : "";
  if (!raw) return { ok: false, error: "path is required." };
  if (!raw.startsWith("/")) {
    return {
      ok: false,
      error: "path must start with '/' (in-app absolute path only — no external URLs).",
    };
  }
  if (raw.includes("://") || raw.includes("//")) {
    return { ok: false, error: "path must not contain a protocol or '//'." };
  }
  // Strip query/hash for the allow-list check, but keep them for the emit.
  const pathOnly = raw.split(/[?#]/)[0];
  const allowed = NAVIGATE_ALLOWED_PREFIXES.some(
    (p) => pathOnly === p || pathOnly.startsWith(`${p}/`),
  );
  if (!allowed) {
    return {
      ok: false,
      error: `path '${pathOnly}' is not in the allowed navigation set: ${NAVIGATE_ALLOWED_PREFIXES.join(", ")}.`,
    };
  }
  // Reject self-navigation: if the user is already on this control page,
  // calling navigate_user_to is a hallucinated no-op that confuses the
  // model into re-introducing the same practice. Force Charlie to keep
  // working on the current practice instead of pretending it just moved.
  const activeControlId = ctx.activeControlId;
  const activeAssessmentId = ctx.activeAssessmentId;
  if (activeAssessmentId && activeControlId) {
    const currentControlPath = `/assessments/${activeAssessmentId}/controls/${activeControlId}`;
    if (pathOnly === currentControlPath) {
      return {
        ok: false,
        error: `already_on_target: The user is already on '${currentControlPath}'. Do NOT navigate — you are on this practice right now. Continue the interview for '${activeControlId}' by calling 'interview_for_control_narrative' with the user's last answer, or ask the next focused question.`,
      };
    }
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  return {
    ok: true,
    data: {
      navigate: raw,
      reason: reason || undefined,
    },
  };
}

// ---------- Tier 2.1: verify_sam_registration ----------

async function handleVerifySamRegistration(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const org = await loadOrgLegalEntity(ctx.organizationId);
  const supplied = typeof input.uei === "string" ? input.uei.trim().toUpperCase() : "";
  const ueiOnFile = (org.uei ?? "").trim().toUpperCase();
  const lookupUei = supplied || ueiOnFile;
  if (!lookupUei) {
    return {
      ok: false,
      error:
        "No UEI provided and no UEI on file. Save the SAM UEI on the organization profile first.",
    };
  }
  const status = await getSamEntityStatus(lookupUei);
  const mismatches: Array<{ field: string; got: string | null; expected: string | null }> = [];
  if (supplied && ueiOnFile && supplied !== ueiOnFile) {
    mismatches.push({ field: "uei", got: ueiOnFile, expected: supplied });
  }
  if (status.kind === "active" && status.legalBusinessName && org.name) {
    // Case-insensitive comparison; ignore extra whitespace.
    const samName = status.legalBusinessName.trim().toLowerCase().replace(/\s+/g, " ");
    const orgName = org.name.trim().toLowerCase().replace(/\s+/g, " ");
    if (samName !== orgName) {
      mismatches.push({
        field: "legal_name",
        got: org.name,
        expected: status.legalBusinessName,
      });
    }
  }
  return {
    ok: true,
    data: {
      uei: lookupUei,
      kind: status.kind,
      legal_business_name:
        status.kind === "active" ? status.legalBusinessName : null,
      expiration_date:
        status.kind === "active" || status.kind === "inactive"
          ? status.expirationDate
          : null,
      reason:
        status.kind === "inactive" || status.kind === "unknown"
          ? status.reason
          : null,
      mismatches,
      warning: summarizeSamStatus(status),
    },
  };
}

// ---------- Tier 2.2 / 2.3: evidence attach / remove ----------

const OBJECTIVE_LETTER_TUPLE = ["a", "b", "c", "d", "e", "f"] as const;
type ObjectiveLetter = (typeof OBJECTIVE_LETTER_TUPLE)[number];

function parseLetter(input: Record<string, unknown>): ObjectiveLetter | null {
  const raw = typeof input.letter === "string" ? input.letter.toLowerCase() : "";
  return (OBJECTIVE_LETTER_TUPLE as readonly string[]).includes(raw)
    ? (raw as ObjectiveLetter)
    : null;
}

async function handleAttachEvidenceToObjective(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via listEvidenceForAssessment + getAssessmentForUser
  const artifactId = typeof input.artifact_id === "string" ? input.artifact_id : "";
  const controlId = typeof input.control_id === "string" ? input.control_id : "";
  const letter = parseLetter(input);
  if (!artifactId) return { ok: false, error: "artifact_id is required." };
  if (!controlId) return { ok: false, error: "control_id is required." };
  if (!letter) return { ok: false, error: "letter must be one of a, b, c, d, e, f." };
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No assessment found." };
  // Tenant check: assessment must belong to a user-visible org.
  await getAssessmentForUser(assessmentId, ctx.userId);
  // Verify artifact exists on this assessment (any control).
  const allEvidence = await listEvidenceForAssessment(assessmentId);
  if (!allEvidence.some((e) => e.id === artifactId)) {
    return {
      ok: false,
      error: "Artifact not found on this assessment. Upload it first via /assessments.",
    };
  }
  // Look up existing letters tagged for this (artifact, control). Returns
  // empty array if not yet tagged for this control.
  const tagged = await listEvidenceForControl(assessmentId, controlId);
  const existing = tagged.find((e) => e.id === artifactId);
  const merged = new Set<string>(existing?.tagged_objectives ?? []);
  merged.add(letter);
  const objectives = Array.from(merged).sort();
  await tagArtifactPractice({
    artifactId,
    assessmentId,
    controlId,
    objectives,
    userId: ctx.userId,
  });
  return {
    ok: true,
    data: {
      artifact_id: artifactId,
      control_id: controlId,
      objectives,
    },
  };
}

async function handleRemoveEvidenceFromObjective(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via getAssessmentForUser + listEvidenceForAssessment
  const artifactId = typeof input.artifact_id === "string" ? input.artifact_id : "";
  const controlId = typeof input.control_id === "string" ? input.control_id : "";
  const letter = parseLetter(input);
  if (!artifactId) return { ok: false, error: "artifact_id is required." };
  if (!controlId) return { ok: false, error: "control_id is required." };
  if (!letter) return { ok: false, error: "letter must be one of a, b, c, d, e, f." };
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No assessment found." };
  await getAssessmentForUser(assessmentId, ctx.userId);
  const tagged = await listEvidenceForControl(assessmentId, controlId);
  const existing = tagged.find((e) => e.id === artifactId);
  if (!existing) {
    return {
      ok: false,
      error: "Artifact is not currently tagged to this control on this assessment.",
    };
  }
  const remaining = (existing.tagged_objectives ?? []).filter((o) => o !== letter);
  if (remaining.length === 0) {
    // No letters left → drop the whole (artifact, control) tag row.
    await untagArtifactPractice({ artifactId, assessmentId, controlId });
    return {
      ok: true,
      data: { artifact_id: artifactId, control_id: controlId, objectives: [] },
    };
  }
  await tagArtifactPractice({
    artifactId,
    assessmentId,
    controlId,
    objectives: remaining.sort(),
    userId: ctx.userId,
  });
  return {
    ok: true,
    data: { artifact_id: artifactId, control_id: controlId, objectives: remaining.sort() },
  };
}

// ---------- Tier 2.6: record_exception / clear_exception ----------

async function handleRecordException(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via getAssessmentForUser
  const controlId = typeof input.control_id === "string" ? input.control_id : "";
  const kindRaw = typeof input.kind === "string" ? input.kind : "";
  const rationale = typeof input.rationale === "string" ? input.rationale.trim() : "";
  if (!controlId) return { ok: false, error: "control_id is required." };
  if (kindRaw !== "enduring_exception" && kindRaw !== "temporary_deficiency") {
    return {
      ok: false,
      error: "kind must be 'enduring_exception' or 'temporary_deficiency'.",
    };
  }
  if (rationale.length < 20) {
    return {
      ok: false,
      error: "rationale must be at least 20 characters explaining the gap and justification.",
    };
  }
  if (!legacyToRequirement[controlId]) {
    return { ok: false, error: `Unknown control_id '${controlId}'.` };
  }
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No assessment found." };
  await getAssessmentForUser(assessmentId, ctx.userId);
  const exceptionType = kindRaw === "enduring_exception" ? "enduring" : "temporary";
  await setControlException({
    assessmentId,
    controlId,
    exceptionType,
    notes: rationale,
  });
  return {
    ok: true,
    data: {
      assessment_id: assessmentId,
      control_id: controlId,
      exception_type: exceptionType,
      needs_milestone: exceptionType === "temporary",
    },
  };
}

async function handleClearException(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via getAssessmentForUser
  const controlId = typeof input.control_id === "string" ? input.control_id : "";
  if (!controlId) return { ok: false, error: "control_id is required." };
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No assessment found." };
  await getAssessmentForUser(assessmentId, ctx.userId);
  await clearControlException({ assessmentId, controlId });
  return {
    ok: true,
    data: { assessment_id: assessmentId, control_id: controlId },
  };
}

// ---------- Tier 2.7: preflight_affirmation ----------

async function handlePreflightAffirmation(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — scopes via getAssessmentForUser + assembleBoundaryView (orgId)
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No assessment found." };
  await getAssessmentForUser(assessmentId, ctx.userId);

  const [responses, evidence, legalEntity] = await Promise.all([
    listResponsesForAssessment(assessmentId),
    listEvidenceForAssessment(assessmentId),
    loadOrgLegalEntity(ctx.organizationId),
  ]);
  const view = await assembleBoundaryView({
    organizationId: ctx.organizationId,
    legalEntity,
  });
  const findings = validateBoundary(view);
  const findingCountsBucket = findingCounts(findings);

  const controlBlockers = await controlsBlockingAffirmation(
    assessmentId,
    responses.map((r) => ({ control_id: r.control_id, status: r.status })),
  );
  const evidenceBlockers = evidenceReviewBlockers(evidence);
  const boundaryFailures = findings.filter((f) => f.level === "fail");

  const blockers: Array<{
    section: "controls" | "evidence" | "boundary" | "affirming_official";
    detail: Record<string, unknown>;
  }> = [];
  for (const b of controlBlockers) {
    blockers.push({
      section: "controls",
      detail: { control_id: b.controlId, status: b.status, reason: b.reason },
    });
  }
  for (const b of evidenceBlockers) {
    blockers.push({
      section: "evidence",
      detail: { artifact_id: b.id, filename: b.filename, reason: b.reason },
    });
  }
  for (const f of boundaryFailures) {
    blockers.push({
      section: "boundary",
      detail: { code: f.code, message: f.message, level: f.level },
    });
  }
  if (!view.affirming_official) {
    blockers.push({
      section: "affirming_official",
      detail: { reason: "No affirming official recorded on the scope profile." },
    });
  }

  const progress = computeProgress(responses);

  return {
    ok: true,
    data: {
      ready: blockers.length === 0,
      blockers,
      progress,
      boundary_findings: findingCountsBucket,
      ready_for_ssp: isReadyForSsp(findings),
    },
  };
}

// ---------- Tier 2.8: boundary FCI flow + out-of-scope CRUD ----------

function pickString(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" ? v : undefined;
}

async function handleRemoveFciFlow(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return { ok: false, error: "id is required." };
  const current = await getScopeProfile(ctx.organizationId);
  const before = current.flows.length;
  const filtered = current.flows.filter((f) => f.id !== id);
  if (filtered.length === before) {
    return { ok: false, error: `No FCI flow with id '${id}'.` };
  }
  await patchScopeProfile(ctx.organizationId, { flows: filtered });
  return { ok: true, data: { id, remaining: filtered.length } };
}

async function handleUpdateFciFlow(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return { ok: false, error: "id is required." };
  const current = await getScopeProfile(ctx.organizationId);
  const idx = current.flows.findIndex((f) => f.id === id);
  if (idx < 0) return { ok: false, error: `No FCI flow with id '${id}'.` };
  const existing = current.flows[idx];
  const direction = pickString(input, "direction");
  const channel = pickString(input, "channel");
  const description = pickString(input, "description");
  const counterparty = pickString(input, "counterparty");
  const touches = Array.isArray(input.touches_scope_item_ids)
    ? (input.touches_scope_item_ids.filter((x): x is string => typeof x === "string"))
    : undefined;
  const ALLOWED_DIRS = ["inbound", "outbound", "bidirectional", "internal"] as const;
  const ALLOWED_CHANS = [
    "email",
    "portal",
    "sftp",
    "api",
    "removable_media",
    "paper",
    "internal_sync",
    "other",
  ] as const;
  if (direction !== undefined && !(ALLOWED_DIRS as readonly string[]).includes(direction)) {
    return { ok: false, error: `direction must be one of ${ALLOWED_DIRS.join(", ")}.` };
  }
  if (channel !== undefined && !(ALLOWED_CHANS as readonly string[]).includes(channel)) {
    return { ok: false, error: `channel must be one of ${ALLOWED_CHANS.join(", ")}.` };
  }
  const updated = {
    ...existing,
    ...(direction !== undefined ? { direction: direction as typeof existing.direction } : {}),
    ...(channel !== undefined ? { channel: channel as typeof existing.channel } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(counterparty !== undefined ? { counterparty: counterparty || null } : {}),
    ...(touches !== undefined ? { touches_scope_item_ids: touches } : {}),
  };
  const flows = current.flows.slice();
  flows[idx] = updated;
  await patchScopeProfile(ctx.organizationId, { flows });
  return { ok: true, data: { id, flow: updated } };
}

async function handleRemoveOutOfScopeItem(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return { ok: false, error: "id is required." };
  const current = await getScopeProfile(ctx.organizationId);
  const before = current.out_of_scope.length;
  const filtered = current.out_of_scope.filter((o) => o.id !== id);
  if (filtered.length === before) {
    return { ok: false, error: `No out-of-scope item with id '${id}'.` };
  }
  await patchScopeProfile(ctx.organizationId, { out_of_scope: filtered });
  return { ok: true, data: { id, remaining: filtered.length } };
}

async function handleUpdateOutOfScopeItem(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return { ok: false, error: "id is required." };
  const current = await getScopeProfile(ctx.organizationId);
  const idx = current.out_of_scope.findIndex((o) => o.id === id);
  if (idx < 0) return { ok: false, error: `No out-of-scope item with id '${id}'.` };
  const existing = current.out_of_scope[idx];
  const asset = pickString(input, "asset");
  const reason = pickString(input, "reason");
  const segregation = pickString(input, "segregation");
  const updated = {
    ...existing,
    ...(asset !== undefined ? { asset } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...(segregation !== undefined ? { segregation } : {}),
  };
  const out_of_scope = current.out_of_scope.slice();
  out_of_scope[idx] = updated;
  await patchScopeProfile(ctx.organizationId, { out_of_scope });
  return { ok: true, data: { id, item: updated } };
}

// ---------- Tier 2.9: save_scoping_statement ----------

async function handleSaveScopingStatement(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const narrative = typeof input.narrative === "string" ? input.narrative.trim() : null;
  if (narrative === null) {
    return { ok: false, error: "narrative is required (string)." };
  }
  if (narrative.length > 0 && narrative.length < 20) {
    return {
      ok: false,
      error:
        "narrative must be at least 20 characters, or an empty string to clear.",
    };
  }
  if (narrative.length > 4000) {
    return { ok: false, error: "narrative must be 4000 characters or fewer." };
  }
  await patchScopeProfile(ctx.organizationId, {
    narrative: narrative.length === 0 ? null : narrative,
  });
  return {
    ok: true,
    data: {
      length: narrative.length,
      cleared: narrative.length === 0,
    },
  };
}

// ---------- Tier 2.4: regenerate_deliverable ----------

async function handleRegenerateDeliverable(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  // audit:tenant-scoping skip — uses ctx.userId + getAssessmentForUser for
  // SSP/attestation/bid_packet via download URL, ctx.organizationId for
  // trust_profile recomputation. Bid-package download URL hits a route
  // that re-checks org ownership before serving bytes.
  const kind = typeof input.kind === "string" ? input.kind : "";
  const allowed = new Set([
    "ssp",
    "attestation",
    "bid_packet",
    "bid_package",
    "trust_profile",
  ]);
  if (!allowed.has(kind)) {
    return {
      ok: false,
      error: `kind must be one of: ssp, attestation, bid_packet, bid_package, trust_profile.`,
    };
  }
  const draft = typeof input.draft === "boolean" ? input.draft : false;
  const generatedAt = new Date().toISOString();

  if (kind === "trust_profile") {
    // Trust profile is org-scoped, not assessment-scoped. Recompute the
    // live snapshot and return the public URL.
    const snapshot = await recomputeTrustStatus(ctx.organizationId);
    const sql = getSql();
    const rows = (await sql`
      SELECT verification_slug, slug
      FROM trust_pages
      WHERE organization_id = ${ctx.organizationId}
      LIMIT 1
    `) as Array<{ verification_slug: string | null; slug: string | null }>;
    const publicSlug =
      rows[0]?.verification_slug ?? rows[0]?.slug ?? null;
    return {
      ok: true,
      data: {
        kind: "trust_profile",
        regenerated: true,
        generated_at: generatedAt,
        health: snapshot.health,
        public_url: publicSlug ? `/verified/${publicSlug}` : null,
        message: publicSlug
          ? "Trust profile snapshot recomputed. The public page at /verified/{slug} now reflects the latest data."
          : "Trust profile snapshot recomputed. No public trust page is published yet — publish one from Trust settings to share the URL.",
      },
    };
  }

  // Assessment-scoped deliverables: resolve + tenant-check via the existing
  // helper, then return a stable download URL.
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) {
    return { ok: false, error: "No active assessment for this org." };
  }
  const owned = await getAssessmentForUser(assessmentId, ctx.userId);
  if (!owned) {
    return {
      ok: false,
      error: "Assessment not found or you do not have access.",
    };
  }

  // Cache-bust the URL so the user's browser fetches a fresh render even
  // when the underlying route is on a CDN.
  const cacheBust = `t=${Date.now()}`;
  let url: string;
  let filenameHint: string;
  if (kind === "bid_package") {
    const q = draft ? `?draft=1&${cacheBust}` : `?${cacheBust}`;
    url = `/api/assessments/${assessmentId}/bid-package${q}`;
    filenameHint = "bid-package.zip";
  } else if (kind === "bid_packet") {
    url = `/api/assessments/${assessmentId}/bid-packet?${cacheBust}`;
    filenameHint = "bid-ready-packet.html";
  } else if (kind === "ssp") {
    // SSP is served as part of the bid-package ZIP today. Use the bundle
    // route with draft=1 so unsigned assessments still render. The user
    // unpacks 01-SSP.html from the ZIP. (A dedicated SSP-only endpoint
    // can be added later if friction shows up.)
    url = `/api/assessments/${assessmentId}/bid-package?draft=1&${cacheBust}`;
    filenameHint = "01-SSP.html (inside the ZIP)";
  } else {
    // attestation — same story as SSP today.
    url = `/api/assessments/${assessmentId}/bid-package?draft=1&${cacheBust}`;
    filenameHint = "02-Affirmation.html (inside the ZIP)";
  }

  return {
    ok: true,
    data: {
      kind,
      regenerated: true,
      generated_at: generatedAt,
      download_url: url,
      filename_hint: filenameHint,
      attested: owned.assessment.status === "attested",
      draft,
    },
  };
}

// ---------- Tier 2.5: file_material_change ----------

async function handleFileMaterialChange(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const reason = pickString(input, "reason")?.trim() ?? "";
  if (reason.length < 20) {
    return {
      ok: false,
      error: "reason must be at least 20 characters describing the change.",
    };
  }
  if (reason.length > 2000) {
    return { ok: false, error: "reason must be 2000 characters or fewer." };
  }
  const rawChanges = input.changes;
  if (!rawChanges || typeof rawChanges !== "object" || Array.isArray(rawChanges)) {
    return {
      ok: false,
      error: "changes must be an object describing what changed.",
    };
  }
  const changes = rawChanges as Record<string, unknown>;
  const requiresReassessment =
    typeof input.requires_reassessment === "boolean"
      ? input.requires_reassessment
      : false;

  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) {
    return { ok: false, error: "No active assessment for this org." };
  }
  // Tenant-scope check: confirm caller owns the assessment before INSERT.
  const owned = await getAssessmentForUser(assessmentId, ctx.userId);
  if (!owned) {
    return {
      ok: false,
      error: "Assessment not found or you do not have access.",
    };
  }
  if (owned.organization.id !== ctx.organizationId) {
    return { ok: false, error: "Assessment belongs to a different organization." };
  }

  const filed = await fileMaterialChange({
    assessmentId,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    reason,
    changes,
    requiresReassessment,
  });

  // When the change forces a fresh cycle, flip the assessment-level snapshot
  // so the affirmation bar re-prompts. Annual-review interview field stays
  // separate — this is a parallel signal, not a replacement.
  if (requiresReassessment) {
    const sql = getSql();
    await sql`
      UPDATE assessments
      SET material_change_required_reassessment = TRUE,
          material_change_details = ${JSON.stringify({
            source: "file_material_change",
            filing_id: filed.id,
            reason,
            filed_at: filed.filed_at,
          })}::jsonb
      WHERE id = ${assessmentId}
        AND organization_id = ${ctx.organizationId}
    `;
  }

  await recordAuditEvent({
    action: "assessment.material_change_filed",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "assessment",
    resourceId: assessmentId,
    metadata: {
      filing_id: filed.id,
      requires_reassessment: requiresReassessment,
      reason_length: reason.length,
    },
  });

  return {
    ok: true,
    data: {
      filing_id: filed.id,
      filed_at: filed.filed_at,
      requires_reassessment: requiresReassessment,
      message: requiresReassessment
        ? "Material change filed. Reassessment is required — the affirmation will be re-prompted."
        : "Material change filed. Current affirmation remains valid; this entry is on the audit log.",
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Tier 3: SSP Narrative Copilot handlers
// ═══════════════════════════════════════════════════════════════════════

// Shared minimums: narratives shorter than this are treated as "weak" by
// bulk_draft_remaining_narratives. The official assessment.ts validators
// already enforce ≥120 for N/A and ≥200 for "Met w/o evidence" — this
// threshold is just our "this control needs help" line.
const WEAK_NARRATIVE_THRESHOLD = 80;
const MAX_NARRATIVE_LENGTH = 4000;

/**
 * Resolve + tenant-check the assessment for a narrative-copilot tool call.
 * Returns the assessmentId on success, or a ToolResult on error so the
 * caller can `if (..."ok" in r) return r;`.
 */
async function resolveNarrativeContext(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ assessmentId: string } | ToolResult> {
  const assessmentId = await resolveAssessmentId(input, ctx);
  if (!assessmentId) return { ok: false, error: "No active assessment." };
  const owned = await getAssessmentForUser(assessmentId, ctx.userId);
  if (!owned) {
    return {
      ok: false,
      error: "Assessment not found or you do not have access.",
    };
  }
  if (owned.organization.id !== ctx.organizationId) {
    return { ok: false, error: "Assessment belongs to a different organization." };
  }
  return { assessmentId };
}

function isToolResult(x: unknown): x is ToolResult {
  return (
    typeof x === "object" && x !== null && "ok" in (x as Record<string, unknown>)
  );
}

function normalizeControlId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Accept either lowercase or uppercase. Catalog keys are uppercase.
  return trimmed.toUpperCase();
}

// ---------- Tier 3.1: draft_control_narrative ----------

async function handleDraftControlNarrative(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const controlId = normalizeControlId(input.control_id);
  if (!controlId) {
    return { ok: false, error: "control_id is required." };
  }
  const resolved = await resolveNarrativeContext(input, ctx);
  if (isToolResult(resolved)) return resolved;
  const { assessmentId } = resolved;

  const controlCtx = await gatherControlContext({
    organizationId: ctx.organizationId,
    assessmentId,
    controlId,
  });

  if (!hasMinimumContext(controlCtx)) {
    return {
      ok: true,
      data: {
        control_id: controlId,
        draft: null,
        needs_more_context: true,
        message:
          "Not enough company-specific context yet to write a grounded narrative. Call `interview_for_control_narrative` first — Charlie will ask a few short questions.",
      },
    };
  }

  const result = await draftControlNarrative({
    organizationId: ctx.organizationId,
    ctx: controlCtx,
  });

  if (result.needsMoreContext) {
    return {
      ok: true,
      data: {
        control_id: controlId,
        draft: null,
        needs_more_context: true,
        message:
          "Claude flagged that more context is needed. Call `interview_for_control_narrative` to gather specifics.",
      },
    };
  }

  await recordAuditEvent({
    action: "narrative.drafted",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "control_response",
    resourceId: `${assessmentId}:${controlId}`,
    metadata: {
      draft_length: result.draft.length,
      regenerated_for_slop: result.regeneratedForSlop,
      cited_evidence_count: result.citedEvidence.length,
    },
  });

  return {
    ok: true,
    data: {
      control_id: controlId,
      draft: result.draft,
      draft_length: result.draft.length,
      cited_evidence: result.citedEvidence,
      regenerated_for_slop: result.regeneratedForSlop,
      needs_more_context: false,
      message:
        "Draft generated. Review it, edit if needed, then call `save_control_narrative` to persist.",
    },
  };
}

// ---------- Tier 3.2: interview_for_control_narrative ----------

async function handleInterviewForControlNarrative(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const controlId = normalizeControlId(input.control_id);
  if (!controlId) {
    return { ok: false, error: "control_id is required." };
  }
  const resolved = await resolveNarrativeContext(input, ctx);
  if (isToolResult(resolved)) return resolved;
  const { assessmentId } = resolved;

  const session = await getOrCreateInterviewSession({
    organizationId: ctx.organizationId,
    assessmentId,
    controlId,
    userId: ctx.userId,
  });

  // If the caller supplied an answer to the most recent question, record
  // it before asking what's next.
  const rawAnswer = pickString(input, "answer");
  let working = session;
  if (rawAnswer !== undefined) {
    const answer = rawAnswer.trim();
    if (answer.length === 0) {
      return { ok: false, error: "answer must not be empty." };
    }
    if (answer.length > 2000) {
      return { ok: false, error: "answer must be 2000 characters or fewer." };
    }
    const hasUnanswered = working.turns.some((t) => t.a === null);
    if (!hasUnanswered) {
      return {
        ok: false,
        error:
          "No outstanding question to answer. Call this tool without `answer` to get the next question.",
      };
    }
    working = await answerLastInterviewTurn({
      sessionId: working.id,
      organizationId: ctx.organizationId,
      answer,
    });
    // Save on entry: the moment the interview has any answered turn we
    // bump control_responses from `unanswered` → `partial` so the overall
    // practices progress bar moves and the user can see their work
    // landed. Idempotent — never overrides yes/no/not_applicable.
    try {
      await markResponseInProgress({ assessmentId, controlId });
    } catch (err) {
      console.warn("markResponseInProgress failed (non-fatal)", err);
    }
  }

  // Refresh context after any answer — evidence/scope may have changed
  // out-of-band, but more importantly the businessProfile growth from
  // chat is reflected here.
  const controlCtx = await gatherControlContext({
    organizationId: ctx.organizationId,
    assessmentId,
    controlId,
  });

  const next = await askNextInterviewQuestion({
    organizationId: ctx.organizationId,
    ctx: controlCtx,
    turns: working.turns,
  });

  if (!next.ready && next.question) {
    const newTurn = {
      q: next.question,
      a: null,
      asked_at: new Date().toISOString(),
      answered_at: null,
    };
    working = await appendInterviewTurn({
      sessionId: working.id,
      organizationId: ctx.organizationId,
      turn: newTurn,
    });
    return {
      ok: true,
      data: {
        control_id: controlId,
        session_id: working.id,
        ready: false,
        question: next.question,
        turn_count: working.turns.length,
      },
    };
  }

  // Ready to draft.
  const draft = await draftControlNarrative({
    organizationId: ctx.organizationId,
    ctx: controlCtx,
    interviewAnswers: working.turns,
  });

  if (draft.needsMoreContext) {
    // Pathological — model flipped its mind. Surface honestly.
    return {
      ok: true,
      data: {
        control_id: controlId,
        session_id: working.id,
        ready: false,
        question:
          "Could you tell me more about how this control is actually implemented at your company?",
        turn_count: working.turns.length,
        note: "Drafting model still wants more context.",
      },
    };
  }

  await markSessionDrafted({
    sessionId: working.id,
    organizationId: ctx.organizationId,
    draftNarrative: draft.draft,
  });

  await recordAuditEvent({
    action: "narrative.drafted",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "control_response",
    resourceId: `${assessmentId}:${controlId}`,
    metadata: {
      via: "interview",
      session_id: working.id,
      turn_count: working.turns.length,
      regenerated_for_slop: draft.regeneratedForSlop,
    },
  });

  return {
    ok: true,
    data: {
      control_id: controlId,
      session_id: working.id,
      ready: true,
      draft: draft.draft,
      draft_length: draft.draft.length,
      cited_evidence: draft.citedEvidence,
      turn_count: working.turns.length,
      message:
        "Charlie has enough context — draft generated. Review and call `save_control_narrative` to persist.",
    },
  };
}

// ---------- Tier 3.3: save_control_narrative ----------

async function handleSaveControlNarrative(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const controlId = normalizeControlId(input.control_id);
  if (!controlId) {
    return { ok: false, error: "control_id is required." };
  }
  const narrative = pickString(input, "narrative")?.trim() ?? "";
  if (narrative.length < WEAK_NARRATIVE_THRESHOLD) {
    return {
      ok: false,
      error: `narrative must be at least ${WEAK_NARRATIVE_THRESHOLD} characters.`,
    };
  }
  if (narrative.length > MAX_NARRATIVE_LENGTH) {
    return {
      ok: false,
      error: `narrative must be ${MAX_NARRATIVE_LENGTH} characters or fewer.`,
    };
  }
  const resolved = await resolveNarrativeContext(input, ctx);
  if (isToolResult(resolved)) return resolved;
  const { assessmentId } = resolved;

  const saved = await saveNarrative({
    assessmentId,
    controlId,
    narrative,
  });

  await recordAuditEvent({
    action: "narrative.saved",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "control_response",
    resourceId: saved.id,
    metadata: {
      control_id: controlId,
      narrative_length: narrative.length,
    },
  });

  return {
    ok: true,
    data: {
      control_response_id: saved.id,
      control_id: controlId,
      narrative_length: narrative.length,
      saved_at: saved.updated_at,
    },
  };
}

// ---------- Tier 3.4: critique_control_narrative ----------

async function handleCritiqueControlNarrative(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const controlId = normalizeControlId(input.control_id);
  if (!controlId) {
    return { ok: false, error: "control_id is required." };
  }
  const resolved = await resolveNarrativeContext(input, ctx);
  if (isToolResult(resolved)) return resolved;
  const { assessmentId } = resolved;

  const controlCtx = await gatherControlContext({
    organizationId: ctx.organizationId,
    assessmentId,
    controlId,
  });
  const existing = controlCtx.existingResponse?.narrative?.trim() ?? "";
  if (existing.length < WEAK_NARRATIVE_THRESHOLD) {
    return {
      ok: true,
      data: {
        control_id: controlId,
        ready: false,
        weaknesses: [
          existing.length === 0
            ? "No narrative on file yet. Draft one with `draft_control_narrative` or `interview_for_control_narrative`."
            : `Narrative is only ${existing.length} characters — too short to demonstrate implementation.`,
        ],
        critiqued_at: new Date().toISOString(),
      },
    };
  }

  const critique = await critiqueControlNarrative({
    organizationId: ctx.organizationId,
    ctx: controlCtx,
    narrative: existing,
  });

  const recorded = await recordCritique({
    organizationId: ctx.organizationId,
    assessmentId,
    controlId,
    userId: ctx.userId,
    narrative: existing,
    ready: critique.ready,
    weaknesses: critique.weaknesses,
  });

  await recordAuditEvent({
    action: "narrative.critiqued",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "control_response",
    resourceId: `${assessmentId}:${controlId}`,
    metadata: {
      critique_id: recorded.id,
      ready: critique.ready,
      weakness_count: critique.weaknesses.length,
    },
  });

  return {
    ok: true,
    data: {
      control_id: controlId,
      ready: critique.ready,
      weaknesses: critique.weaknesses,
      critique_id: recorded.id,
      critiqued_at: recorded.critiqued_at,
    },
  };
}

// ---------- Tier 3.5: bulk_draft_remaining_narratives ----------

async function handleBulkDraftRemainingNarratives(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const resolved = await resolveNarrativeContext(input, ctx);
  if (isToolResult(resolved)) return resolved;
  const { assessmentId } = resolved;

  // L1 control universe = keys of controlCitations whose id contains "L1".
  const l1ControlIds = Object.keys(controlCitations).filter((id) =>
    id.includes(".L1-"),
  );

  // Find which controls actually need a draft right now.
  const existing = await listResponsesForAssessment(assessmentId);
  const byControl = new Map(existing.map((r) => [r.control_id, r]));

  const candidates = l1ControlIds.filter((controlId) => {
    const row = byControl.get(controlId);
    const narrative = row?.narrative?.trim() ?? "";
    return narrative.length < WEAK_NARRATIVE_THRESHOLD;
  });

  // Each draft is a Sonnet call — run them serially so we don't blow
  // through the rate limit on a single tool invocation. With ~15 L1
  // controls this is still fast enough; if it ever needs concurrency
  // it can be promise-pooled later.
  const drafts: Array<{
    control_id: string;
    draft: string | null;
    needs_more_context: boolean;
    regenerated_for_slop: boolean;
    cited_evidence: string[];
    error?: string;
  }> = [];
  for (const controlId of candidates) {
    try {
      const controlCtx = await gatherControlContext({
        organizationId: ctx.organizationId,
        assessmentId,
        controlId,
      });
      if (!hasMinimumContext(controlCtx)) {
        drafts.push({
          control_id: controlId,
          draft: null,
          needs_more_context: true,
          regenerated_for_slop: false,
          cited_evidence: [],
        });
        continue;
      }
      const r = await draftControlNarrative({
        organizationId: ctx.organizationId,
        ctx: controlCtx,
      });
      drafts.push({
        control_id: controlId,
        draft: r.needsMoreContext ? null : r.draft,
        needs_more_context: r.needsMoreContext,
        regenerated_for_slop: r.regeneratedForSlop,
        cited_evidence: r.citedEvidence,
      });
    } catch (err) {
      drafts.push({
        control_id: controlId,
        draft: null,
        needs_more_context: false,
        regenerated_for_slop: false,
        cited_evidence: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await recordAuditEvent({
    action: "narrative.drafted",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "assessment",
    resourceId: assessmentId,
    metadata: {
      via: "bulk",
      control_count: candidates.length,
      drafts_with_content: drafts.filter((d) => d.draft).length,
      controls_needing_interview: drafts.filter((d) => d.needs_more_context)
        .length,
    },
  });

  return {
    ok: true,
    data: {
      assessment_id: assessmentId,
      considered: l1ControlIds.length,
      candidates: candidates.length,
      drafts,
      message:
        drafts.length === 0
          ? "All L1 controls already have substantive narratives."
          : `Drafted ${
              drafts.filter((d) => d.draft).length
            } narratives. Review each and call \`save_control_narrative\` for the ones you want to keep.`,
    },
  };
}
