"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  appendMessage,
  createUserEscalation,
  getEscalationForOrg,
  isValidUrgency,
  setEmailMessageId,
} from "@/lib/escalations";
import {
  sendTicketToOfficers,
  type SendTicketArgs,
} from "@/lib/email/officer-ticket";
import { recordAuditEvent } from "@/lib/security/audit-log";
import { checkRateLimit } from "@/lib/security/rate-limit";

const MAX_TOPIC = 140;
const MAX_BODY = 8000;
const MIN_BODY = 8;

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

async function resolveSender(userId: string): Promise<{
  email: string | null;
  name: string | null;
}> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
    return { email, name };
  } catch (err) {
    console.warn("[ticket] could not resolve sender from Clerk:", err);
    return { email: null, name: null };
  }
}

/** Open a new ticket from the platform. Sends mail to support@custodia.dev. */
export async function createTicketAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const org = await ensureOrgForUser(userId);

  const topic = String(formData.get("topic") ?? "").trim().slice(0, MAX_TOPIC);
  const summary = String(formData.get("summary") ?? "").trim().slice(0, MAX_BODY);
  const urgencyRaw = String(formData.get("urgency") ?? "routine");
  const urgency = isValidUrgency(urgencyRaw) ? urgencyRaw : "routine";

  if (!topic) throw new Error("Topic is required.");
  if (summary.length < MIN_BODY) {
    throw new Error("Tell us a little more about what's going on (8+ chars).");
  }

  // Cap to 5 new tickets per org per hour. Stops accidental form spam without
  // getting in the way of a real outage flurry.
  const rl = await checkRateLimit(`ticket-create:${org.id}`, {
    max: 5,
    windowSec: 60 * 60,
  });
  if (!rl.allowed) {
    throw new Error(
      `Too many tickets opened recently. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.`,
    );
  }

  const sender = await resolveSender(userId);

  const escalation = await createUserEscalation({
    organizationId: org.id,
    userId,
    userEmail: sender.email,
    topic,
    urgency,
    summary,
  });

  await recordAuditEvent({
    action: "evidence.tagged", // reuse existing audit verb; ticket lives under officer_escalations
    userId,
    organizationId: org.id,
    resourceType: "officer_escalation",
    resourceId: escalation.id,
    metadata: { kind: "ticket_opened", urgency, topic },
  });

  // Best-effort outbound. If the email fails the ticket still exists in the
  // platform — the user sees their ticket, and an officer with DB access can
  // pick it up. We log loudly so on-call notices.
  try {
    await sendTicketToOfficers({
      escalation,
      orgName: org.name,
      userEmail: sender.email,
      userName: sender.name,
      body: summary,
      isOpening: true,
    } satisfies SendTicketArgs);
  } catch (err) {
    console.error(
      `[ticket] outbound email failed for escalation ${escalation.id}:`,
      err,
    );
  }

  revalidatePath("/assessments/tickets");
  redirect(`/assessments/tickets/${escalation.id}`);
}

/** Post a reply on an existing ticket. */
export async function replyToTicketAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const org = await ensureOrgForUser(userId);

  const escalationId = String(formData.get("escalationId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_BODY);
  if (!escalationId) throw new Error("Ticket id required.");
  if (body.length < MIN_BODY) {
    throw new Error("Reply is too short.");
  }

  const escalation = await getEscalationForOrg(escalationId, org.id);
  if (!escalation) throw new Error("Ticket not found.");

  // Per-ticket rate limit: 30 replies/hour. High enough to never be hit by
  // a normal back-and-forth, low enough to stop a runaway script.
  const rl = await checkRateLimit(`ticket-reply:${escalationId}`, {
    max: 30,
    windowSec: 60 * 60,
  });
  if (!rl.allowed) {
    throw new Error("Slow down — too many replies in a short window.");
  }

  const sender = await resolveSender(userId);
  const inserted = await appendMessage({
    escalationId,
    senderType: "user",
    senderUserId: userId,
    senderEmail: sender.email,
    body,
  });

  try {
    const messageId = await sendTicketToOfficers({
      escalation,
      orgName: org.name,
      userEmail: sender.email,
      userName: sender.name,
      body,
      isOpening: false,
    });
    await setEmailMessageId(inserted.id, messageId);
  } catch (err) {
    console.error(
      `[ticket] reply email failed for escalation ${escalationId}:`,
      err,
    );
  }

  revalidatePath(`/assessments/tickets/${escalationId}`);
  revalidatePath("/assessments/tickets");
}
