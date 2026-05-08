/**
 * FCI Boundary Diagram — typed overlay on top of the existing
 * scope_inventory / esp_registry / specialized_assets tables.
 *
 * The platform already captures *who/what/where* in scope_inventory and
 * *what ESP* in esp_registry. To render a defensible boundary diagram
 * (SSP § 1.2) we additionally need:
 *
 *   - DATA FLOWS:       how FCI enters / leaves / moves internally
 *   - OUT-OF-SCOPE:     explicitly excluded items + why + how segregated
 *   - AFFIRMING OFFICER: SPRS signer identity + signed acknowledgement
 *
 * Those three live in `organizations.scope_profile` (JSONB). Everything
 * else is read live from the existing tables — single source of truth,
 * no duplication.
 *
 * See plans/fci-boundary-scope.md.
 */

import { getSql } from "@/lib/db";
import {
  listScopeItems,
  listEsps,
  type ScopeItemRow,
  type EspRow,
} from "@/lib/cmmc/scope";
import { randomUUID } from "node:crypto";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export const SCOPE_PROFILE_VERSION = 1 as const;

export type FlowDirection = "inbound" | "outbound" | "internal";

export type FlowChannel =
  | "prime_portal"
  | "email"
  | "sftp"
  | "api"
  | "removable_media"
  | "paper"
  | "internal_sync"
  | "other";

export type ScopeFlow = {
  id: string;
  direction: FlowDirection;
  channel: FlowChannel;
  /** Plain-English description; e.g. "Prime sends drawings via Exostar". */
  description: string;
  /** Counterparty (free text); e.g. "Lockheed Martin RMS" or "internal". */
  counterparty: string | null;
  /** Optional: scope_inventory.id values touched by this flow. */
  touches_scope_item_ids: string[];
};

export type OutOfScopeItem = {
  id: string;
  asset: string;
  reason: string;
  segregation: string;
};

export type AffirmingOfficial = {
  name: string;
  title: string;
  email: string;
  /** ISO 8601; null = not yet acknowledged. */
  acknowledged_at: string | null;
};

export type ScopeProfile = {
  version: typeof SCOPE_PROFILE_VERSION;
  flows: ScopeFlow[];
  out_of_scope: OutOfScopeItem[];
  affirming_official: AffirmingOfficial | null;
  /** Free-text overview the affirming official can edit; appears below diagram. */
  narrative: string | null;
  generated_at: string;
};

export function emptyScopeProfile(): ScopeProfile {
  return {
    version: SCOPE_PROFILE_VERSION,
    flows: [],
    out_of_scope: [],
    affirming_official: null,
    narrative: null,
    generated_at: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────────────────────────

/**
 * Reads the typed scope profile off `organizations.scope_profile` and
 * normalizes legacy / partial rows. Always returns a usable profile.
 */
export async function getScopeProfile(
  organizationId: string,
): Promise<ScopeProfile> {
  const sql = getSql();
  const rows = (await sql`
    SELECT scope_profile
    FROM organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `) as Array<{ scope_profile: unknown }>;
  const raw = rows[0]?.scope_profile;
  return normalizeScopeProfile(raw);
}

export async function saveScopeProfile(
  organizationId: string,
  profile: ScopeProfile,
): Promise<void> {
  const sql = getSql();
  const next = {
    ...profile,
    version: SCOPE_PROFILE_VERSION,
    generated_at: new Date().toISOString(),
  };
  await sql`
    UPDATE organizations
    SET scope_profile = ${JSON.stringify(next)}::jsonb,
        updated_at = NOW()
    WHERE id = ${organizationId}
  `;
}

/**
 * Patches a partial profile onto whatever's stored. Arrays replace; scalars
 * merge.
 */
export async function patchScopeProfile(
  organizationId: string,
  patch: Partial<ScopeProfile>,
): Promise<ScopeProfile> {
  const current = await getScopeProfile(organizationId);
  const merged: ScopeProfile = {
    ...current,
    ...patch,
    version: SCOPE_PROFILE_VERSION,
    generated_at: new Date().toISOString(),
  };
  await saveScopeProfile(organizationId, merged);
  return merged;
}

// ────────────────────────────────────────────────────────────────────
// Auto-draft from business profile (intake answers)
// ────────────────────────────────────────────────────────────────────

/**
 * Heuristically seeds an empty scope profile from the 10 onboarding intake
 * answers. Pure function — caller decides whether to persist. Returns a NEW
 * profile (does not mutate input). Only fills slots the user hasn't already
 * touched. Every seeded item is tagged with `(suggested)` in its description
 * so the user can spot inferences vs. confirmed entries.
 *
 * Heuristic rules:
 *   - data_location mentions email   → inbound:email flow ("primes send specs")
 *   - data_location mentions cloud   → internal:internal_sync flow
 *   - data_location mentions laptop  → internal:internal_sync flow
 *   - it_identity mentions m365/g.w. → outbound:prime_portal flow placeholder
 *   - customer_facing_product=services → out_of_scope: marketing site
 *   - team_size implies BYOD likely  → out_of_scope: BYOD phones
 */
export function seedScopeProfileFromBusinessProfile(
  current: ScopeProfile,
  profileData: Record<string, unknown> | null | undefined,
): ScopeProfile {
  if (!profileData) return current;
  // Only seed if user hasn't started editing yet — never overwrite.
  if (current.flows.length > 0 || current.out_of_scope.length > 0) {
    return current;
  }

  const lower = (k: string): string => {
    const v = profileData[k];
    return typeof v === "string" ? v.toLowerCase() : "";
  };
  const dataLocation = lower("data_location");
  const itIdentity = lower("it_identity");
  const customerFacing = lower("customer_facing_product");
  const teamSize = lower("team_size");
  const network = lower("network");

  const flows: ScopeFlow[] = [];
  const oos: OutOfScopeItem[] = [];

  // Inbound: every defense subcontractor receives FCI somehow. Default = email.
  if (dataLocation || itIdentity) {
    flows.push({
      id: randomUUID(),
      direction: "inbound",
      channel: "email",
      description:
        "(suggested) Prime contractor sends contract information by email — confirm and refine.",
      counterparty: null,
      touches_scope_item_ids: [],
    });
  }

  // Internal sync if user mentioned a cloud share or laptops
  if (
    /sharepoint|onedrive|google drive|drive|cloud|m365|microsoft 365|workspace|share/.test(
      dataLocation,
    ) ||
    /sharepoint|onedrive|m365|google/.test(itIdentity)
  ) {
    flows.push({
      id: randomUUID(),
      direction: "internal",
      channel: "internal_sync",
      description:
        "(suggested) Cloud share syncs to team laptops — confirm device coverage.",
      counterparty: "internal",
      touches_scope_item_ids: [],
    });
  }

  // Outbound: typical prime delivery. Default placeholder.
  flows.push({
    id: randomUUID(),
    direction: "outbound",
    channel: "prime_portal",
    description:
      "(suggested) Deliverables uploaded to prime portal (Exostar, PIEE, etc.) — confirm channel.",
    counterparty: null,
    touches_scope_item_ids: [],
  });

  // OOS suggestions
  if (/service|consult/.test(customerFacing)) {
    oos.push({
      id: randomUUID(),
      asset: "(suggested) Public marketing website",
      reason:
        "Marketing only — never receives or stores contract information.",
      segregation:
        "Hosted separately from the M365 / production tenant; no integration with FCI systems.",
    });
  }

  if (
    /solo|small|few|2|3|4|5|6|7|8|9|10/.test(teamSize) ||
    /remote|home/.test(network)
  ) {
    oos.push({
      id: randomUUID(),
      asset: "(suggested) Personal phones (BYOD)",
      reason:
        "Personal devices are not used to access or store contract information.",
      segregation:
        "Conditional access policy blocks unmanaged devices from SharePoint / OneDrive; FCI never lands on personal devices.",
    });
  }

  return {
    ...current,
    flows,
    out_of_scope: oos,
    generated_at: new Date().toISOString(),
  };
}

function normalizeScopeProfile(raw: unknown): ScopeProfile {
  if (!raw || typeof raw !== "object") return emptyScopeProfile();
  const r = raw as Partial<ScopeProfile>;
  return {
    version: SCOPE_PROFILE_VERSION,
    flows: Array.isArray(r.flows) ? r.flows.map(normalizeFlow) : [],
    out_of_scope: Array.isArray(r.out_of_scope)
      ? r.out_of_scope.map(normalizeOos)
      : [],
    affirming_official: r.affirming_official
      ? normalizeAffirming(r.affirming_official)
      : null,
    narrative: typeof r.narrative === "string" ? r.narrative : null,
    generated_at:
      typeof r.generated_at === "string"
        ? r.generated_at
        : new Date().toISOString(),
  };
}

function normalizeFlow(f: Partial<ScopeFlow> | unknown): ScopeFlow {
  const v = (f && typeof f === "object" ? f : {}) as Partial<ScopeFlow>;
  return {
    id: typeof v.id === "string" && v.id.length > 0 ? v.id : randomUUID(),
    direction:
      v.direction === "outbound" || v.direction === "internal"
        ? v.direction
        : "inbound",
    channel:
      typeof v.channel === "string" &&
      [
        "prime_portal",
        "email",
        "sftp",
        "api",
        "removable_media",
        "paper",
        "internal_sync",
        "other",
      ].includes(v.channel)
        ? (v.channel as FlowChannel)
        : "other",
    description: typeof v.description === "string" ? v.description : "",
    counterparty: typeof v.counterparty === "string" ? v.counterparty : null,
    touches_scope_item_ids: Array.isArray(v.touches_scope_item_ids)
      ? v.touches_scope_item_ids.filter((s): s is string => typeof s === "string")
      : [],
  };
}

function normalizeOos(o: Partial<OutOfScopeItem> | unknown): OutOfScopeItem {
  const v = (o && typeof o === "object" ? o : {}) as Partial<OutOfScopeItem>;
  return {
    id: typeof v.id === "string" && v.id.length > 0 ? v.id : randomUUID(),
    asset: typeof v.asset === "string" ? v.asset : "",
    reason: typeof v.reason === "string" ? v.reason : "",
    segregation: typeof v.segregation === "string" ? v.segregation : "",
  };
}

function normalizeAffirming(
  a: Partial<AffirmingOfficial> | unknown,
): AffirmingOfficial | null {
  const v = (a && typeof a === "object" ? a : {}) as Partial<AffirmingOfficial>;
  if (!v.name && !v.email) return null;
  return {
    name: typeof v.name === "string" ? v.name : "",
    title: typeof v.title === "string" ? v.title : "",
    email: typeof v.email === "string" ? v.email : "",
    acknowledged_at:
      typeof v.acknowledged_at === "string" ? v.acknowledged_at : null,
  };
}

// ────────────────────────────────────────────────────────────────────
// Boundary view (assembled for rendering)
// ────────────────────────────────────────────────────────────────────

export type BoundaryView = {
  legal_entity: {
    id: string;
    name: string;
    cage: string | null;
    uei: string | null;
    naics: string[];
  };
  people: ScopeItemRow[];
  technology: ScopeItemRow[];
  facilities: ScopeItemRow[];
  esps: EspRow[];
  scope_inventory_esps: ScopeItemRow[]; // ESP rows in scope_inventory (legacy/alt path)
  flows: ScopeFlow[];
  out_of_scope: OutOfScopeItem[];
  affirming_official: AffirmingOfficial | null;
  narrative: string | null;
  generated_at: string;
};

export async function assembleBoundaryView(args: {
  organizationId: string;
  legalEntity: BoundaryView["legal_entity"];
}): Promise<BoundaryView> {
  const [items, esps, profile] = await Promise.all([
    listScopeItems(args.organizationId),
    listEsps(args.organizationId),
    getScopeProfile(args.organizationId),
  ]);
  return {
    legal_entity: args.legalEntity,
    people: items.filter((i) => i.kind === "people"),
    technology: items.filter((i) => i.kind === "technology"),
    facilities: items.filter((i) => i.kind === "facility"),
    esps,
    scope_inventory_esps: items.filter((i) => i.kind === "esp"),
    flows: profile.flows,
    out_of_scope: profile.out_of_scope,
    affirming_official: profile.affirming_official,
    narrative: profile.narrative,
    generated_at: profile.generated_at,
  };
}

// ────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────

export type FindingLevel = "pass" | "warn" | "fail";

export type ScopeFinding = {
  level: FindingLevel;
  code: string;
  message: string;
  /** FAR / CMMC L1 control IDs this finding gates. */
  control_refs?: string[];
};

const KNOWN_PUBLIC_SHARING_TOKENS = [
  "anyone with the link",
  "public",
  "anonymous",
  "everyone",
];

/**
 * Pure validator. Run before SSP generation; `fail` rows block the
 * generate button, `warn` rows require the affirming official to one-click
 * acknowledge.
 */
export function validateBoundary(view: BoundaryView): ScopeFinding[] {
  const findings: ScopeFinding[] = [];

  // PEOPLE ------------------------------------------------------------
  if (view.people.length === 0) {
    findings.push({
      level: "fail",
      code: "PEOPLE_EMPTY",
      message:
        "No people are listed as handling FCI. Add at least one in-scope user before generating the SSP.",
      control_refs: ["AC.L1-3.1.1", "IA.L1-3.5.1"],
    });
  } else {
    findings.push({
      level: "pass",
      code: "PEOPLE_OK",
      message: `${view.people.length} in-scope user${
        view.people.length === 1 ? "" : "s"
      } identified.`,
    });
  }

  // TECHNOLOGY / STORAGE ---------------------------------------------
  if (view.technology.length === 0) {
    findings.push({
      level: "fail",
      code: "STORAGE_EMPTY",
      message:
        "No technology assets in scope. List at least one system that stores, processes, or transmits FCI (mailbox, SharePoint site, file server, laptop).",
      control_refs: ["AC.L1-3.1.1", "MP.L1-3.8.3"],
    });
  } else {
    findings.push({
      level: "pass",
      code: "STORAGE_OK",
      message: `${view.technology.length} technology asset${
        view.technology.length === 1 ? "" : "s"
      } in scope.`,
    });
  }

  // ESPs --------------------------------------------------------------
  const totalEsps = view.esps.length + view.scope_inventory_esps.length;
  if (totalEsps === 0) {
    findings.push({
      level: "warn",
      code: "ESP_EMPTY",
      message:
        "No External Service Providers declared. Most CMMC L1 SMBs depend on at least one ESP (M365, Google Workspace, the managing MSP, this platform). Confirm none are in use.",
      control_refs: ["AC.L1-3.1.20"],
    });
  } else {
    findings.push({
      level: "pass",
      code: "ESP_OK",
      message: `${totalEsps} External Service Provider${
        totalEsps === 1 ? "" : "s"
      } declared.`,
    });
  }

  // OUT-OF-SCOPE -----------------------------------------------------
  if (view.out_of_scope.length === 0) {
    findings.push({
      level: "warn",
      code: "OOS_EMPTY",
      message:
        "Out-of-scope list is empty. Reviewers expect at least one explicit exclusion (marketing site, BYOD, accounting, etc.) with a segregation rationale.",
    });
  } else {
    const incomplete = view.out_of_scope.filter(
      (o) => !o.reason.trim() || !o.segregation.trim(),
    );
    if (incomplete.length > 0) {
      findings.push({
        level: "warn",
        code: "OOS_INCOMPLETE",
        message: `${incomplete.length} out-of-scope item${
          incomplete.length === 1 ? "" : "s"
        } missing a reason or segregation rationale.`,
      });
    } else {
      findings.push({
        level: "pass",
        code: "OOS_OK",
        message: `${view.out_of_scope.length} out-of-scope item${
          view.out_of_scope.length === 1 ? "" : "s"
        } declared with rationale.`,
      });
    }
  }

  // FLOWS -------------------------------------------------------------
  const inbound = view.flows.filter((f) => f.direction === "inbound");
  const outbound = view.flows.filter((f) => f.direction === "outbound");
  if (inbound.length === 0) {
    findings.push({
      level: "warn",
      code: "FLOWS_NO_INBOUND",
      message:
        "No inbound FCI flow declared. Reviewers will ask how FCI reaches the business — describe at least one inbound channel.",
      control_refs: ["SC.L1-3.13.1"],
    });
  }
  if (outbound.length === 0) {
    findings.push({
      level: "warn",
      code: "FLOWS_NO_OUTBOUND",
      message:
        "No outbound FCI flow declared. Even read-only contractors typically reply via email or upload deliverables; document the outbound channel.",
      control_refs: ["SC.L1-3.13.1"],
    });
  }
  if (
    view.flows.some((f) => f.channel === "removable_media") &&
    view.facilities.length === 0
  ) {
    findings.push({
      level: "warn",
      code: "REMOVABLE_MEDIA_NO_FACILITY",
      message:
        "Removable media flow declared but no in-scope facility. Confirm the media-sanitization SOP (MP.L1-3.8.3) covers all locations where the media is handled.",
      control_refs: ["MP.L1-3.8.3"],
    });
  }

  // Public sharing on storage -----------------------------------------
  for (const t of view.technology) {
    const blob = `${t.label} ${t.role ?? ""} ${t.notes ?? ""}`.toLowerCase();
    if (KNOWN_PUBLIC_SHARING_TOKENS.some((tok) => blob.includes(tok))) {
      findings.push({
        level: "fail",
        code: "STORAGE_PUBLIC_SHARING",
        message: `"${t.label}" looks publicly shared. Restrict access before this asset can carry FCI.`,
        control_refs: ["AC.L1-3.1.20", "AC.L1-3.1.22"],
      });
    }
  }

  // AFFIRMING OFFICIAL ------------------------------------------------
  if (!view.affirming_official) {
    findings.push({
      level: "fail",
      code: "AO_MISSING",
      message:
        "No affirming official captured. SPRS submission requires a named, titled, contactable signer.",
    });
  } else {
    const ao = view.affirming_official;
    if (!ao.name.trim() || !ao.title.trim() || !ao.email.trim()) {
      findings.push({
        level: "fail",
        code: "AO_INCOMPLETE",
        message:
          "Affirming official is missing name, title, or email. All three are required for SPRS.",
      });
    } else if (!ao.acknowledged_at) {
      findings.push({
        level: "fail",
        code: "AO_NOT_ACK",
        message:
          "Affirming official has not yet acknowledged the boundary. Capture their acknowledgement before generating the SSP.",
      });
    } else {
      findings.push({
        level: "pass",
        code: "AO_OK",
        message: `Affirming official acknowledged ${formatRelative(
          ao.acknowledged_at,
        )}.`,
      });
    }
  }

  // LEGAL ENTITY ------------------------------------------------------
  if (
    !view.legal_entity.name ||
    view.legal_entity.name === "My Organization" ||
    view.legal_entity.name === "Managed business"
  ) {
    findings.push({
      level: "fail",
      code: "ENTITY_NAME_MISSING",
      message:
        "Legal entity name is still a placeholder. Update to the registered business name before generating the SSP.",
    });
  }
  if (!view.legal_entity.naics || view.legal_entity.naics.length === 0) {
    findings.push({
      level: "warn",
      code: "ENTITY_NAICS_MISSING",
      message:
        "No NAICS codes on file. Add at least one — opportunity matching and the affirmation header both depend on it.",
    });
  }

  return findings;
}

export function findingCounts(findings: ScopeFinding[]): {
  pass: number;
  warn: number;
  fail: number;
} {
  return findings.reduce(
    (acc, f) => {
      acc[f.level] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

export function isReadyForSsp(findings: ScopeFinding[]): boolean {
  return findings.every((f) => f.level !== "fail");
}

// ────────────────────────────────────────────────────────────────────
// Misc helpers
// ────────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export const flowChannelLabels: Record<FlowChannel, string> = {
  prime_portal: "Prime portal",
  email: "Email",
  sftp: "SFTP",
  api: "API",
  removable_media: "Removable media",
  paper: "Paper",
  internal_sync: "Internal sync",
  other: "Other",
};

export const flowDirectionLabels: Record<FlowDirection, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  internal: "Internal",
};
