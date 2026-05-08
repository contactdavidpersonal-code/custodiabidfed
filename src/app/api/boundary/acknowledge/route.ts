/**
 * Affirming Official acknowledgement endpoint. Stamps acknowledged_at = now()
 * on the scope_profile.affirming_official block. Caller must be a member of
 * the active org. The AO's name/title/email must already be saved (validation
 * gate enforces this).
 */

import { auth } from "@clerk/nextjs/server";
import { ensureOrgForUser, getActiveOrgFromAuth } from "@/lib/assessment";
import {
  getScopeProfile,
  patchScopeProfile,
} from "@/lib/cmmc/boundary";

export const runtime = "nodejs";

export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const org = orgId
    ? (await getActiveOrgFromAuth()) ?? (await ensureOrgForUser(userId))
    : await ensureOrgForUser(userId);

  const current = await getScopeProfile(org.id);
  const ao = current.affirming_official;
  if (!ao || !ao.name.trim() || !ao.title.trim() || !ao.email.trim()) {
    return Response.json(
      { error: "AO_INCOMPLETE", message: "Save name, title, and email first." },
      { status: 400 },
    );
  }

  await patchScopeProfile(org.id, {
    affirming_official: { ...ao, acknowledged_at: new Date().toISOString() },
  });

  return Response.json({ ok: true });
}
