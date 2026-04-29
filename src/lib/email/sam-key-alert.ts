import { getFromAddress, getReplyToAddress, getResend } from "./client";

/**
 * Plain admin alert sent when SAM.gov rejects our api_key. The radar cron
 * fires this exactly once per failed run (weekly cap by virtue of the cron
 * schedule) and skips all subscriber digests so nobody gets stale-bid mail
 * while the key is broken.
 *
 * Default recipient is `df3@custodia.com` per ops; override with
 * `SAM_KEY_ALERT_EMAIL` if needed.
 */
export async function sendSamKeyAlert(args: {
  status: number;
  body: string;
  orgsAffected: number;
}): Promise<string> {
  const to = process.env.SAM_KEY_ALERT_EMAIL ?? "df3@custodia.com";
  const snippet = args.body.slice(0, 200).replace(/[<>]/g, "");
  const subject = "[Custodia] SAM.gov API key needs help";
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.55;color:#10231d">
      <h2 style="color:#b03a2e;margin:0 0 12px">SAM.gov radar paused — key rejected</h2>
      <p>The Mondays SAM.gov opportunity radar tried to run and got an
        authentication failure from <code>api.sam.gov</code>. No subscriber
        digests were sent for this run.</p>
      <table style="border-collapse:collapse;margin:18px 0;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#5a7d70"><b>Status</b></td><td>${args.status}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a7d70"><b>Orgs that would have received digests</b></td><td>${args.orgsAffected}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#5a7d70;vertical-align:top"><b>SAM.gov response</b></td><td><pre style="background:#f7f7f3;padding:8px;border-radius:6px;white-space:pre-wrap;margin:0">${snippet}</pre></td></tr>
      </table>
      <p><b>To fix:</b></p>
      <ol>
        <li>Log into the SAM.gov account that owns the radar key.</li>
        <li>Go to <em>Account Details → API Key</em> and click <em>Regenerate</em>.</li>
        <li>Copy the new key and update <code>SAM_GOV_API_KEY</code> in Vercel project env (production).</li>
        <li>Redeploy or wait for the next Monday cron — the radar will resume automatically.</li>
      </ol>
      <p style="color:#5a7d70;font-size:12px;margin-top:24px">
        Sent automatically by Custodia. The next run will retry the key on its
        normal schedule and send a fresh alert if the problem persists.
      </p>
    </div>
  `;
  const text = [
    "SAM.gov radar paused — key rejected.",
    "",
    `Status: ${args.status}`,
    `Orgs that would have received digests: ${args.orgsAffected}`,
    `SAM.gov response: ${snippet}`,
    "",
    "To fix:",
    "1. Log into SAM.gov with the account that owns the radar key.",
    "2. Account Details → API Key → Regenerate.",
    "3. Update SAM_GOV_API_KEY in Vercel production env.",
    "4. Redeploy or wait for next Monday — the cron will resume automatically.",
  ].join("\n");

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [to],
    replyTo: getReplyToAddress(),
    subject,
    html,
    text,
    headers: { "X-Entity-Ref-ID": "custodia-sam-key-alert-v1" },
  });
  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
  return result.data?.id ?? "unknown";
}
