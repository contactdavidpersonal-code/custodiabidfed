/**
 * MSP-only: create / list intake invitations for the active organization.
 *
 * Auth: Clerk-authenticated user with access to the org. The MSP plan check
 * is intentionally light — any user inside the org can issue an invite for
 * that org (the MSP IS the operator of the org in MSP-mode).
 */

import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { ensureOrgForUser, getActiveOrgFromAuth } from "@/lib/assessment";
import {
  createIntakeInvitation,
  inviteUrl,
  listIntakeInvitationsForOrg,
  revokeIntakeInvitation,
  INTAKE_SECTIONS,
  type IntakeSection,
} from "@/lib/intake-invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveCaller() {
  const { userId, orgId } = await auth();
  if (!userId) return { error: "unauthorized" as const };
  const org = orgId
    ? (await getActiveOrgFromAuth()) ?? (await ensureOrgForUser(userId))
    : await ensureOrgForUser(userId);
  return { userId, org };
}

export async function GET() {
  const r = await resolveCaller();
  if ("error" in r) return new Response("Unauthorized", { status: 401 });
  const rows = await listIntakeInvitationsForOrg(r.org.id);
  return Response.json({
    invitations: rows.map((row) => ({
      id: row.id,
      client_email: row.client_email,
      client_name: row.client_name,
      sections: row.sections,
      completed_sections: row.completed_sections,
      last_seen_at: row.last_seen_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      created_at: row.created_at,
      url: inviteUrl(row.token),
    })),
  });
}

export async function POST(req: NextRequest) {
  const r = await resolveCaller();
  if ("error" in r) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const b = (body ?? {}) as {
    client_email?: unknown;
    client_name?: unknown;
    sections?: unknown;
  };

  const email = typeof b.client_email === "string" ? b.client_email.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "client_email is required" }, { status: 400 });
  }
  const name =
    typeof b.client_name === "string" && b.client_name.trim()
      ? b.client_name.trim()
      : null;

  let sections: IntakeSection[] = [...INTAKE_SECTIONS];
  if (Array.isArray(b.sections)) {
    const filtered = b.sections.filter(
      (s): s is IntakeSection =>
        typeof s === "string" && (INTAKE_SECTIONS as readonly string[]).includes(s),
    );
    if (filtered.length > 0) sections = filtered;
  }

  const invite = await createIntakeInvitation({
    organizationId: r.org.id,
    createdByUserId: r.userId,
    clientEmail: email,
    clientName: name,
    sections,
  });

  return Response.json({
    id: invite.id,
    client_email: invite.client_email,
    client_name: invite.client_name,
    sections: invite.sections,
    completed_sections: invite.completed_sections,
    expires_at: invite.expires_at,
    url: inviteUrl(invite.token),
  });
}

export async function DELETE(req: NextRequest) {
  const r = await resolveCaller();
  if ("error" in r) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const ok = await revokeIntakeInvitation({ id, organizationId: r.org.id });
  return Response.json({ ok });
}
