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
  listResponsesForAssessment,
  tagArtifactPractice,
  updateBusinessProfile,
} from "@/lib/assessment";
import { playbookById } from "@/lib/playbook";
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
  listEsps,
  listScopeItems,
  listSpecializedAssets,
} from "@/lib/cmmc/scope";
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
import { getPracticeSpec } from "@/lib/cmmc/practice-spec";
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
      "Generate a real evidence artifact directly into the user's evidence vault for the practice they're currently working on. Use this when the user has given you enough information to fill an evidence slot AND that slot's destinations include 'generated' (rosters, service-account lists, written procedures, scoping statements). DO NOT type the artifact's full content into chat — call this tool, and the artifact appears in the middle pane's Evidence section ready for the user to download or replace. After calling this, give a 1-2 sentence chat summary of what you produced, e.g. 'I dropped an Authorized Users Roster into your evidence — it lists you as the sole user, on Windows 11 + Pixel 9a. Replace it if anything's wrong.' Do NOT call this tool for evidence that requires a screenshot or live system export — those still need the user to upload manually or connect M365/Google Workspace.",
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
            "Filename including extension. Use .md for narrative procedures and .csv for tabular rosters/inventories. Example: 'authorized-users-roster.csv', 'access-grant-removal-procedure.md'.",
        },
        format: {
          type: "string",
          enum: ["markdown", "csv", "text"],
          description:
            "How to interpret `content`. 'csv' must be valid RFC4180 CSV. 'markdown' is rendered as text/markdown. 'text' is plain text.",
        },
        content: {
          type: "string",
          description:
            "Full file content. For CSV, include the header row. For markdown procedures, use a clean H1 + numbered steps + an 'as of' date. Be specific to the user's environment using only facts they have actually confirmed in the conversation — never invent names, emails, or system details.",
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
    name: "add_scope_item",
    description:
      "Add a People / Technology / Facility row to the org's CMMC L1 scope inventory (32 CFR § 170.19(b)(3)). Use during the scope-inventory step when the user lists who or what handles FCI. Each call writes ONE item — call multiple times for a list. Read scope_inventory_state first if you need to avoid duplicates. Do NOT call this for ESPs (use add_esp) or for IoT/OT/GFE (use add_specialized_asset).",
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
      "Register an External Service Provider (ESP) in the user's scope inventory. Vendors and managed services that process, store, or transmit FCI on the OSA's behalf — Microsoft 365, Google Workspace, AWS, MSPs, contracted helpdesks. Per CMMC Scoping Guide L1 v2.13 ESPs are in scope and may share/inherit objectives when supporting evidence (SOC 2, attestation, contract responsibility matrix) is on file.",
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
      "Document a Specialized Asset per 32 CFR § 170.19(b)(2)(ii). Specialized Assets — IoT, IIoT, Operational Technology, Government-Furnished Equipment, Restricted Information Systems, Test Equipment — are listed for completeness but NOT graded against the 15 requirements. Use this when the user mentions a connected sensor, lab fixture, GFE laptop, air-gapped test bench, etc.",
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
 * Dispatch a tool call from the model. Each handler is defensive: invalid
 * input returns `{ ok: false, error }` rather than throwing, so the agent
 * loop can surface the error to the model and it can self-correct.
 */
export async function executeOfficerTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
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
};

const ARTIFACT_FORMAT_EXT: Record<string, string> = {
  csv: ".csv",
  markdown: ".md",
  text: ".txt",
};

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
    return { ok: false, error: "format must be 'csv', 'markdown', or 'text'." };
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
  const slot = spec.evidenceSlots.find((s) => s.key === slotKey);
  if (!slot) {
    return {
      ok: false,
      error: `Unknown slot_key '${slotKey}' for ${spec.controlId}. Valid slots: ${spec.evidenceSlots.map((s) => s.key).join(", ")}.`,
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

  // Normalize filename + ensure correct extension.
  const ext = ARTIFACT_FORMAT_EXT[format];
  const baseName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const withExt = baseName.toLowerCase().endsWith(ext)
    ? baseName
    : `${baseName}${ext}`;
  // Prefix with `[slot:KEY]__` so the practice page can bucket this
  // artifact into the correct slot card. Mirrors `uploadEvidenceAction`.
  const finalName = `[slot:${slotKey}]__${withExt}`;
  const mime = ARTIFACT_FORMAT_MIME[format];

  const pathname = `evidence/${ctx.activeAssessmentId}/${ctx.activeControlId}/${Date.now()}-charlie-${finalName}`;
  const blob = await put(pathname, content, {
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
      (${ctx.activeAssessmentId}, ${ctx.activeControlId}, ${finalName},
       ${blob.url}, ${mime}, ${Buffer.byteLength(content, "utf8")},
       ${ctx.userId},
       'sufficient', ${summary},
       ${[ctx.activeControlId]},
       NOW(), 'charlie-generated')
    RETURNING id
  `) as Array<{ id: string }>;
  const artifactId = inserted[0].id;

  // Tag the artifact onto the practice with the objective letters this
  // slot satisfies — that's how the grader credits it.
  await tagArtifactPractice({
    artifactId,
    assessmentId: ctx.activeAssessmentId,
    controlId: ctx.activeControlId,
    objectives: slot.satisfies,
    userId: ctx.userId,
  });

  return {
    ok: true,
    data: {
      artifact_id: artifactId,
      filename: finalName,
      slot_key: slotKey,
      satisfies_objectives: slot.satisfies,
      message: `Created '${finalName}' in the evidence vault and tagged it to objectives [${slot.satisfies.join(", ")}].`,
    },
  };
}

async function handleEscalateToOfficer(
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
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

  const row = await addScopeItem({
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

  const row = await addEsp({
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

  const row = await addSpecializedAsset({
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
