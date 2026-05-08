/**
 * Email notifications for the client-side intake portal.
 *
 * These fire to the MSP who issued the invitation when their client makes
 * progress. Best-effort — never throw out of this module; the API route
 * wraps in try/catch.
 */

import { getFromAddress, getReplyToAddress, getResend } from "./client";
import type { IntakeSection } from "@/lib/intake-invitations";

const SECTION_LABELS: Record<IntakeSection, string> = {
  profile: "business profile intake",
  boundary: "FCI boundary",
};

export async function sendIntakeSectionCompleteEmail(args: {
  toEmail: string;
  clientEmail: string;
  clientName: string | null;
  section: IntakeSection;
  completedSections: IntakeSection[];
  allSections: IntakeSection[];
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const sectionLabel = SECTION_LABELS[args.section];
  const remaining = args.allSections.filter(
    (s) => !args.completedSections.includes(s),
  );
  const who = args.clientName
    ? `${args.clientName} (${args.clientEmail})`
    : args.clientEmail;

  const subject = `${who} finished the ${sectionLabel} section`;

  const remainingText =
    remaining.length === 0
      ? `All sections are now complete. Time to review the workspace.`
      : `Still pending: ${remaining.map((s) => SECTION_LABELS[s]).join(", ")}.`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#10231d;max-width:560px;margin:24px auto;line-height:1.5">
  <h2 style="font-family:Georgia,serif;color:#0e2a23;margin:0 0 12px">Client intake update</h2>
  <p>${escapeHtml(who)} just finished the <strong>${escapeHtml(sectionLabel)}</strong> section of their intake.</p>
  <p>${escapeHtml(remainingText)}</p>
  <p style="margin-top:24px;font-size:13px;color:#5a7d70">— Charlie, on behalf of Custodia</p>
</body></html>`;

  const text = [
    `${who} just finished the "${sectionLabel}" section of their intake.`,
    ``,
    remainingText,
    ``,
    `— Charlie, on behalf of Custodia`,
  ].join("\n");

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [args.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html,
    text,
    headers: {
      "X-Entity-Ref-ID": "custodia-intake-section-complete",
    },
  });
  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
