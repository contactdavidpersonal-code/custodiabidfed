/**
 * Public: client tells us they finished a section. We mark the invitation,
 * send a notification email to the MSP who created it, and return the
 * updated invitation row.
 *
 * No Clerk auth — the token is the auth.
 */

import type { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getIntakeInvitationByToken,
  markIntakeSectionComplete,
  INTAKE_SECTIONS,
  type IntakeSection,
} from "@/lib/intake-invitations";
import { sendIntakeSectionCompleteEmail } from "@/lib/email/intake-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getIntakeInvitationByToken(token);
  if (!invite) {
    return Response.json({ error: "invalid_or_expired" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    section?: unknown;
  };
  const section = typeof body.section === "string" ? body.section : "";
  if (!(INTAKE_SECTIONS as readonly string[]).includes(section)) {
    return Response.json(
      { error: `section must be one of: ${INTAKE_SECTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await markIntakeSectionComplete(token, section as IntakeSection);
  if (!updated) {
    return Response.json({ error: "update_failed" }, { status: 500 });
  }

  // Best-effort notify the MSP. Never fail the user-facing call on email.
  try {
    const cc = await clerkClient();
    const mspUser = await cc.users.getUser(invite.created_by_user_id);
    const mspEmail = mspUser.primaryEmailAddress?.emailAddress;
    if (mspEmail && process.env.RESEND_API_KEY) {
      await sendIntakeSectionCompleteEmail({
        toEmail: mspEmail,
        clientEmail: invite.client_email,
        clientName: invite.client_name,
        section: section as IntakeSection,
        completedSections: updated.completed_sections,
        allSections: updated.sections,
      });
    }
  } catch (err) {
    console.error("[intake-complete] notify failed", err);
  }

  return Response.json({
    completed_sections: updated.completed_sections,
    sections: updated.sections,
  });
}
