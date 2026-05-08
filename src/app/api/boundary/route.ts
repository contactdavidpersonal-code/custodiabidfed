/**
 * Boundary API — GET returns the assembled BoundaryView + findings;
 * PATCH merges a partial ScopeProfile (flows, out_of_scope, narrative,
 * affirming_official) onto the org. Multi-tenant: all reads/writes are
 * scoped to the active organization for the calling user.
 *
 * No FCI is stored in scope_profile — only metadata (counterparty names,
 * channel types, official's contact). No field-level encryption needed.
 */

import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  ensureOrgForUser,
  getActiveOrgFromAuth,
  getBusinessProfile,
} from "@/lib/assessment";
import {
  assembleBoundaryView,
  getScopeProfile,
  patchScopeProfile,
  saveScopeProfile,
  seedScopeProfileFromBusinessProfile,
  validateBoundary,
  type ScopeProfile,
} from "@/lib/cmmc/boundary";

export const runtime = "nodejs";

async function resolveOrg() {
  const { userId, orgId } = await auth();
  if (!userId) return { error: "unauthorized" as const };
  const org = orgId
    ? (await getActiveOrgFromAuth()) ?? (await ensureOrgForUser(userId))
    : await ensureOrgForUser(userId);
  return { userId, org };
}

function legalEntity(org: Awaited<ReturnType<typeof ensureOrgForUser>>) {
  return {
    id: org.id,
    name: org.name,
    cage: org.cage_code ?? null,
    uei: org.sam_uei ?? null,
    naics: org.naics_codes ?? [],
  };
}

/**
 * On first GET — when scope_profile is still empty — seed flows + OOS from
 * the user's onboarding answers so the diagram is never blank. Idempotent: a
 * non-empty profile is returned untouched.
 */
async function ensureSeeded(orgId: string): Promise<void> {
  const current = await getScopeProfile(orgId);
  if (current.flows.length > 0 || current.out_of_scope.length > 0) return;
  const profile = await getBusinessProfile(orgId);
  const data = (profile?.data as Record<string, unknown> | undefined) ?? null;
  if (!data || Object.keys(data).length === 0) return;
  const seeded = seedScopeProfileFromBusinessProfile(current, data);
  if (seeded.flows.length === 0 && seeded.out_of_scope.length === 0) return;
  await saveScopeProfile(orgId, seeded);
}

export async function GET() {
  const r = await resolveOrg();
  if ("error" in r) return new Response("Unauthorized", { status: 401 });

  await ensureSeeded(r.org.id);

  const view = await assembleBoundaryView({
    organizationId: r.org.id,
    legalEntity: legalEntity(r.org),
  });
  const findings = validateBoundary(view);
  return Response.json({ view, findings });
}

export async function PATCH(req: NextRequest) {
  const r = await resolveOrg();
  if ("error" in r) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return new Response("Invalid body", { status: 400 });
  }

  // Whitelist patchable fields. version + generated_at are server-controlled.
  const patch: Partial<ScopeProfile> = {};
  const b = body as Partial<ScopeProfile>;
  if (Array.isArray(b.flows)) patch.flows = b.flows;
  if (Array.isArray(b.out_of_scope)) patch.out_of_scope = b.out_of_scope;
  if ("affirming_official" in b)
    patch.affirming_official = b.affirming_official ?? null;
  if ("narrative" in b) patch.narrative = b.narrative ?? null;

  await patchScopeProfile(r.org.id, patch);

  const view = await assembleBoundaryView({
    organizationId: r.org.id,
    legalEntity: legalEntity(r.org),
  });
  const findings = validateBoundary(view);
  return Response.json({ view, findings });
}
