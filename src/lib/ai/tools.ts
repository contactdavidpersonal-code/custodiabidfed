import {
  escalationUrgencies,
  getSql,
  milestoneKinds,
  type EscalationUrgency,
  type MilestoneKind,
} from "@/lib/db";
import {
  computeProgress,
  evidenceReviewBlockers,
  getBusinessProfile,
  getAssessmentForUser,
  listAssessmentsForOrg,
  listEvidenceForAssessment,
  listResponsesForAssessment,
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
            "CMMC L1 control ID, e.g. 'AC.L1-3.1.1'. Must be one of the 17 practices.",
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
      "Merge structured business-context facts into the org's business_profile.data JSON. Use during onboarding to capture: what the business does, customers / contract types, team size, existing compliance maturity, tech stack, and risk tolerance. The more specific, the better the officer can tailor future advice. Always re-estimate completeness_score (0-100) based on total facts captured.",
    input_schema: {
      type: "object" as const,
      properties: {
        data: {
          type: "object",
          description:
            "Key/value facts to MERGE (not replace) into business_profile.data. Use descriptive keys like 'what_we_do', 'primary_customers', 'team_size', 'tech_stack', 'contract_status', 'risk_tolerance'. Values can be strings, arrays, or nested objects.",
        },
        completeness_score: {
          type: "number",
          description:
            "Estimated completeness 0-100. 40 is the minimum to leave onboarding; 70+ means the officer can give richly personalized guidance.",
        },
      },
      required: ["data", "completeness_score"],
    },
  },
  {
    name: "cite_regulation",
    description:
      "Look up the authoritative regulatory text for a CMMC L1 practice (by practice id like 'AC.L1-3.1.1') OR a program-level topic (slug like 'fci-definition', 'affirmation-liability', 'sprs-submission', 'sam-registration', 'cmmc-l1-scope', 'annual-cadence'). ALWAYS call this before quoting FAR / NIST / 32 CFR text — never paraphrase the regs from memory. Include the returned 'source' field verbatim when you quote in your answer so the user sees the citation.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: {
          type: "string",
          description:
            "A control id (e.g. 'AC.L1-3.1.1', 'SI.L1-3.14.5') OR a framework slug ('cmmc-l1-scope', 'fci-definition', 'affirmation-liability', 'sprs-submission', 'sam-registration', 'annual-cadence').",
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
      case "search_sam_opportunities":
        return await handleSearchSamOpportunities(input, ctx);
      case "list_inbox_opportunities":
        return await handleListInboxOpportunities(input, ctx);
      case "analyze_opportunity_fit":
        return await handleAnalyzeOpportunityFit(input, ctx);
      case "dismiss_opportunity":
        return await handleDismissOpportunity(input, ctx);
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
  const apiKey = process.env.SAM_GOV_API_KEY;
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

