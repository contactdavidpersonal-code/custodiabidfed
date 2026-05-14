/**
 * 32 CFR § 170.19 scope inventory + Specialized Assets + ESP registry.
 * The assessment scope must be defined before a Level 1 self-assessment
 * begins. People, Technology, Facilities, and ESPs that process / store /
 * transmit FCI are in-scope; Specialized Assets (IoT, IIoT, OT, GFE,
 * Restricted Information Systems, Test Equipment) are documented but not
 * graded. ESPs may inherit objectives on behalf of the OSA when supporting
 * evidence is on file.
 *
 * Source: CMMC Scoping Guide – Level 1, Version 2.13 (Sept 2024).
 */

import { getSql } from "@/lib/db";
import type { ScopeKind, SpecializedAssetType } from "@/lib/db";

export type ScopeItemRow = {
  id: string;
  organization_id: string;
  kind: ScopeKind;
  label: string;
  role: string | null;
  handles_fci: boolean;
  notes: string | null;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listScopeItems(
  organizationId: string,
): Promise<ScopeItemRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, kind, label, role, handles_fci, notes,
           retired_at, created_at, updated_at
    FROM scope_inventory
    WHERE organization_id = ${organizationId}
      AND retired_at IS NULL
    ORDER BY kind, label
  `) as ScopeItemRow[];
}

export async function addScopeItem(args: {
  organizationId: string;
  kind: ScopeKind;
  label: string;
  role?: string | null;
  handlesFci?: boolean;
  notes?: string | null;
}): Promise<ScopeItemRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO scope_inventory
      (organization_id, kind, label, role, handles_fci, notes)
    VALUES
      (${args.organizationId}::uuid, ${args.kind}, ${args.label},
       ${args.role ?? null}, ${args.handlesFci ?? true}, ${args.notes ?? null})
    RETURNING id, organization_id, kind, label, role, handles_fci, notes,
              retired_at, created_at, updated_at
  `) as ScopeItemRow[];
  return rows[0];
}

export async function retireScopeItem(
  scopeItemId: string,
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE scope_inventory
    SET retired_at = NOW(), updated_at = NOW()
    WHERE id = ${scopeItemId} AND organization_id = ${organizationId}
  `;
}

export async function updateScopeItem(args: {
  id: string;
  organizationId: string;
  label: string;
  role: string | null;
  handlesFci: boolean;
  notes: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE scope_inventory
    SET label = ${args.label},
        role = ${args.role},
        handles_fci = ${args.handlesFci},
        notes = ${args.notes},
        updated_at = NOW()
    WHERE id = ${args.id}
      AND organization_id = ${args.organizationId}
      AND retired_at IS NULL
  `;
}

export type EspRow = {
  id: string;
  organization_id: string;
  name: string;
  vendor: string | null;
  services: string | null;
  cmmc_status: string | null;
  attestation_doc_url: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
};

export async function listEsps(organizationId: string): Promise<EspRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, name, vendor, services, cmmc_status,
           attestation_doc_url, contact_email, created_at, updated_at
    FROM esp_registry
    WHERE organization_id = ${organizationId}
    ORDER BY name
  `) as EspRow[];
}

export async function addEsp(args: {
  organizationId: string;
  name: string;
  vendor?: string | null;
  services?: string | null;
  cmmcStatus?: string | null;
  attestationDocUrl?: string | null;
  contactEmail?: string | null;
}): Promise<EspRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO esp_registry
      (organization_id, name, vendor, services, cmmc_status,
       attestation_doc_url, contact_email)
    VALUES
      (${args.organizationId}::uuid, ${args.name}, ${args.vendor ?? null},
       ${args.services ?? null}, ${args.cmmcStatus ?? null},
       ${args.attestationDocUrl ?? null}, ${args.contactEmail ?? null})
    RETURNING id, organization_id, name, vendor, services, cmmc_status,
              attestation_doc_url, contact_email, created_at, updated_at
  `) as EspRow[];
  return rows[0];
}

export async function updateEsp(args: {
  id: string;
  organizationId: string;
  name: string;
  vendor: string | null;
  services: string | null;
  cmmcStatus: string | null;
  attestationDocUrl: string | null;
  contactEmail: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE esp_registry
    SET name = ${args.name},
        vendor = ${args.vendor},
        services = ${args.services},
        cmmc_status = ${args.cmmcStatus},
        attestation_doc_url = ${args.attestationDocUrl},
        contact_email = ${args.contactEmail},
        updated_at = NOW()
    WHERE id = ${args.id} AND organization_id = ${args.organizationId}
  `;
}

export async function deleteEsp(
  espId: string,
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM esp_registry
    WHERE id = ${espId} AND organization_id = ${organizationId}
  `;
}

export type SpecializedAssetRow = {
  id: string;
  organization_id: string;
  label: string;
  asset_type: SpecializedAssetType;
  description: string | null;
  handles_fci: boolean;
  created_at: string;
};

export async function updateSpecializedAsset(args: {
  id: string;
  organizationId: string;
  label: string;
  assetType: SpecializedAssetType;
  description: string | null;
  handlesFci: boolean;
}): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE specialized_assets
    SET label = ${args.label},
        asset_type = ${args.assetType},
        description = ${args.description},
        handles_fci = ${args.handlesFci}
    WHERE id = ${args.id} AND organization_id = ${args.organizationId}
  `;
}

export async function deleteSpecializedAsset(
  assetId: string,
  organizationId: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM specialized_assets
    WHERE id = ${assetId} AND organization_id = ${organizationId}
  `;
}

export async function listSpecializedAssets(
  organizationId: string,
): Promise<SpecializedAssetRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, label, asset_type, description, handles_fci, created_at
    FROM specialized_assets
    WHERE organization_id = ${organizationId}
    ORDER BY asset_type, label
  `) as SpecializedAssetRow[];
}

export async function addSpecializedAsset(args: {
  organizationId: string;
  label: string;
  assetType: SpecializedAssetType;
  description?: string | null;
  handlesFci?: boolean;
}): Promise<SpecializedAssetRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO specialized_assets
      (organization_id, label, asset_type, description, handles_fci)
    VALUES
      (${args.organizationId}::uuid, ${args.label}, ${args.assetType},
       ${args.description ?? null}, ${args.handlesFci ?? true})
    RETURNING id, organization_id, label, asset_type, description, handles_fci, created_at
  `) as SpecializedAssetRow[];
  return rows[0];
}

export const specializedAssetLabels: Record<SpecializedAssetType, string> = {
  iot: "Internet of Things device (IoT)",
  iiot: "Industrial IoT device (IIoT)",
  ot: "Operational Technology (OT)",
  gfe: "Government-Furnished Equipment (GFE)",
  restricted: "Restricted Information System",
  test_equipment: "Test Equipment",
};

export const scopeKindLabels: Record<ScopeKind, string> = {
  people: "People",
  technology: "Technology",
  facility: "Facility",
  esp: "External Service Provider",
};
