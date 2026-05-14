"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  scopeKinds,
  specializedAssetTypes,
  type ScopeKind,
  type SpecializedAssetType,
} from "@/lib/db";
import {
  addEsp,
  addScopeItem,
  addSpecializedAsset,
  deleteEsp,
  deleteSpecializedAsset,
  retireScopeItem,
  updateEsp,
  updateScopeItem,
  updateSpecializedAsset,
} from "@/lib/cmmc/scope";
import { getAssessmentForUser } from "@/lib/assessment";
import { recordAuditEvent } from "@/lib/security/audit-log";

async function requireOrgForAssessment(assessmentId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const ctx = await getAssessmentForUser(assessmentId, userId);
  if (!ctx) throw new Error("Not found");
  return { userId, ctx };
}

const MAX_LABEL_LEN = 200;
const MAX_NOTES_LEN = 2000;

function sanitize(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export async function addScopeItemAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const label = sanitize(String(formData.get("label") ?? ""), MAX_LABEL_LEN);
  const role = sanitize(String(formData.get("role") ?? ""), MAX_LABEL_LEN);
  const handlesFci = formData.get("handlesFci") === "on";
  const notes = sanitize(String(formData.get("notes") ?? ""), MAX_NOTES_LEN);

  if (!scopeKinds.includes(kindRaw as ScopeKind)) {
    throw new Error("Invalid scope kind");
  }
  if (!label) throw new Error("Label is required");

  const { userId, ctx } = await requireOrgForAssessment(assessmentId);

  const row = await addScopeItem({
    organizationId: ctx.organization.id,
    kind: kindRaw as ScopeKind,
    label,
    role: role || null,
    handlesFci,
    notes: notes || null,
  });

  await recordAuditEvent({
    action: "scope_inventory.added",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "scope_inventory",
    resourceId: row.id,
    metadata: { kind: row.kind, handles_fci: row.handles_fci },
  });

  revalidatePath(`/assessments/${assessmentId}/scope`);
}

export async function retireScopeItemAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const scopeItemId = String(formData.get("scopeItemId") ?? "");
  const { userId, ctx } = await requireOrgForAssessment(assessmentId);
  await retireScopeItem(scopeItemId, ctx.organization.id);
  await recordAuditEvent({
    action: "scope_inventory.retired",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "scope_inventory",
    resourceId: scopeItemId,
  });
  revalidatePath(`/assessments/${assessmentId}/scope`);
}

export async function updateScopeItemAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const scopeItemId = String(formData.get("scopeItemId") ?? "");
  const label = sanitize(String(formData.get("label") ?? ""), MAX_LABEL_LEN);
  const role = sanitize(String(formData.get("role") ?? ""), MAX_LABEL_LEN);
  const handlesFci = formData.get("handlesFci") === "on";
  const notes = sanitize(String(formData.get("notes") ?? ""), MAX_NOTES_LEN);

  if (!scopeItemId) throw new Error("Missing scope item id");
  if (!label) throw new Error("Label is required");

  const { userId, ctx } = await requireOrgForAssessment(assessmentId);

  await updateScopeItem({
    id: scopeItemId,
    organizationId: ctx.organization.id,
    label,
    role: role || null,
    handlesFci,
    notes: notes || null,
  });

  await recordAuditEvent({
    action: "scope_inventory.updated",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "scope_inventory",
    resourceId: scopeItemId,
    metadata: { handles_fci: handlesFci },
  });

  // Strip the ?edit= query param after a save so the row collapses back
  // to its static view instead of staying in edit mode.
  revalidatePath(`/assessments/${assessmentId}/scope`);
  redirect(`/assessments/${assessmentId}/scope`);
}

export async function addEspAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const name = sanitize(String(formData.get("name") ?? ""), MAX_LABEL_LEN);
  const vendor = sanitize(String(formData.get("vendor") ?? ""), MAX_LABEL_LEN);
  const services = sanitize(
    String(formData.get("services") ?? ""),
    MAX_NOTES_LEN,
  );
  const cmmcStatus = sanitize(
    String(formData.get("cmmcStatus") ?? ""),
    MAX_LABEL_LEN,
  );
  const attestationDocUrl = sanitize(
    String(formData.get("attestationDocUrl") ?? ""),
    500,
  );
  const contactEmail = sanitize(
    String(formData.get("contactEmail") ?? ""),
    MAX_LABEL_LEN,
  ).toLowerCase();

  if (!name) throw new Error("ESP name is required");
  if (
    contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
  ) {
    throw new Error("Contact email is not a valid address");
  }
  if (
    attestationDocUrl &&
    !/^https?:\/\//i.test(attestationDocUrl)
  ) {
    throw new Error("Attestation URL must be http(s)");
  }

  const { userId, ctx } = await requireOrgForAssessment(assessmentId);

  const row = await addEsp({
    organizationId: ctx.organization.id,
    name,
    vendor: vendor || null,
    services: services || null,
    cmmcStatus: cmmcStatus || null,
    attestationDocUrl: attestationDocUrl || null,
    contactEmail: contactEmail || null,
  });

  await recordAuditEvent({
    action: "esp_registry.added",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "esp_registry",
    resourceId: row.id,
    metadata: { vendor: row.vendor },
  });

  revalidatePath(`/assessments/${assessmentId}/scope`);
}

export async function addSpecializedAssetAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const label = sanitize(String(formData.get("label") ?? ""), MAX_LABEL_LEN);
  const assetTypeRaw = String(formData.get("assetType") ?? "");
  const description = sanitize(
    String(formData.get("description") ?? ""),
    MAX_NOTES_LEN,
  );
  const handlesFci = formData.get("handlesFci") === "on";

  if (!specializedAssetTypes.includes(assetTypeRaw as SpecializedAssetType)) {
    throw new Error("Invalid asset type");
  }
  if (!label) throw new Error("Label is required");

  const { userId, ctx } = await requireOrgForAssessment(assessmentId);

  const row = await addSpecializedAsset({
    organizationId: ctx.organization.id,
    label,
    assetType: assetTypeRaw as SpecializedAssetType,
    description: description || null,
    handlesFci,
  });

  await recordAuditEvent({
    action: "specialized_asset.added",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "specialized_assets",
    resourceId: row.id,
    metadata: { asset_type: row.asset_type, handles_fci: row.handles_fci },
  });

  revalidatePath(`/assessments/${assessmentId}/scope`);
}

export async function updateEspAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const espId = String(formData.get("espId") ?? "");
  const name = sanitize(String(formData.get("name") ?? ""), MAX_LABEL_LEN);
  const vendor = sanitize(String(formData.get("vendor") ?? ""), MAX_LABEL_LEN);
  const services = sanitize(
    String(formData.get("services") ?? ""),
    MAX_NOTES_LEN,
  );
  const cmmcStatus = sanitize(
    String(formData.get("cmmcStatus") ?? ""),
    MAX_LABEL_LEN,
  );
  const attestationDocUrl = sanitize(
    String(formData.get("attestationDocUrl") ?? ""),
    500,
  );
  const contactEmail = sanitize(
    String(formData.get("contactEmail") ?? ""),
    MAX_LABEL_LEN,
  ).toLowerCase();

  if (!espId) throw new Error("Missing ESP id");
  if (!name) throw new Error("ESP name is required");
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Contact email is not a valid address");
  }
  if (attestationDocUrl && !/^https?:\/\//i.test(attestationDocUrl)) {
    throw new Error("Attestation URL must be http(s)");
  }

  const { userId, ctx } = await requireOrgForAssessment(assessmentId);

  await updateEsp({
    id: espId,
    organizationId: ctx.organization.id,
    name,
    vendor: vendor || null,
    services: services || null,
    cmmcStatus: cmmcStatus || null,
    attestationDocUrl: attestationDocUrl || null,
    contactEmail: contactEmail || null,
  });

  await recordAuditEvent({
    action: "esp_registry.updated",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "esp_registry",
    resourceId: espId,
  });

  revalidatePath(`/assessments/${assessmentId}/scope`);
  redirect(`/assessments/${assessmentId}/scope`);
}

export async function deleteEspAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const espId = String(formData.get("espId") ?? "");
  if (!espId) throw new Error("Missing ESP id");
  const { userId, ctx } = await requireOrgForAssessment(assessmentId);
  await deleteEsp(espId, ctx.organization.id);
  await recordAuditEvent({
    action: "esp_registry.deleted",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "esp_registry",
    resourceId: espId,
  });
  revalidatePath(`/assessments/${assessmentId}/scope`);
}

export async function updateSpecializedAssetAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const label = sanitize(String(formData.get("label") ?? ""), MAX_LABEL_LEN);
  const assetTypeRaw = String(formData.get("assetType") ?? "");
  const description = sanitize(
    String(formData.get("description") ?? ""),
    MAX_NOTES_LEN,
  );
  const handlesFci = formData.get("handlesFci") === "on";

  if (!assetId) throw new Error("Missing asset id");
  if (!specializedAssetTypes.includes(assetTypeRaw as SpecializedAssetType)) {
    throw new Error("Invalid asset type");
  }
  if (!label) throw new Error("Label is required");

  const { userId, ctx } = await requireOrgForAssessment(assessmentId);

  await updateSpecializedAsset({
    id: assetId,
    organizationId: ctx.organization.id,
    label,
    assetType: assetTypeRaw as SpecializedAssetType,
    description: description || null,
    handlesFci,
  });

  await recordAuditEvent({
    action: "specialized_asset.updated",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "specialized_assets",
    resourceId: assetId,
    metadata: { asset_type: assetTypeRaw, handles_fci: handlesFci },
  });

  revalidatePath(`/assessments/${assessmentId}/scope`);
  redirect(`/assessments/${assessmentId}/scope`);
}

export async function deleteSpecializedAssetAction(formData: FormData) {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) throw new Error("Missing asset id");
  const { userId, ctx } = await requireOrgForAssessment(assessmentId);
  await deleteSpecializedAsset(assetId, ctx.organization.id);
  await recordAuditEvent({
    action: "specialized_asset.deleted",
    userId,
    organizationId: ctx.organization.id,
    resourceType: "specialized_assets",
    resourceId: assetId,
  });
  revalidatePath(`/assessments/${assessmentId}/scope`);
}
