import {
  getAppBaseUrl,
  getFromAddress,
  getReplyToAddress,
  getResend,
} from "./client";

export type BidDigestConfirmInput = {
  toEmail: string;
  confirmToken: string;
  unsubscribeToken: string;
};

/**
 * Sends the Monday Bid Digest double-opt-in confirmation email. Triggered
 * by POST /api/bid-digest/subscribe. The recipient must click the
 * confirmation link before their address is set to confirmed_at — until
 * then they receive nothing further.
 *
 * Returns the Resend message id on success; throws on transport failure
 * so the caller can decide whether to surface a generic error to the
 * subscriber (we deliberately do NOT leak Resend internals).
 */
export async function sendBidDigestConfirmEmail(
  input: BidDigestConfirmInput,
): Promise<string> {
  const base = getAppBaseUrl();
  const confirmUrl = `${base}/api/bid-digest/confirm?token=${encodeURIComponent(input.confirmToken)}`;
  const unsubscribeUrl = `${base}/api/bid-digest/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`;

  const subject = "Confirm your Monday Bid Digest subscription";

  const result = await getResend().emails.send({
    from: getFromAddress(),
    to: [input.toEmail],
    replyTo: getReplyToAddress(),
    subject,
    html: renderHtml({ confirmUrl, unsubscribeUrl }),
    text: renderText({ confirmUrl, unsubscribeUrl }),
    headers: {
      "X-Entity-Ref-ID": "custodia-bid-digest-confirm-v1",
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (result.error) {
    throw new Error(
      `Resend error: ${result.error.name} — ${result.error.message}`,
    );
  }
  if (!result.data?.id) {
    throw new Error("Resend returned no message id");
  }
  return result.data.id;
}

function renderText(input: {
  confirmUrl: string;
  unsubscribeUrl: string;
}): string {
  return `One more click to confirm.

Every Monday morning at 7am ET, we'll send you a short digest of brand-new
SAM.gov opportunities that match the NAICS codes you picked — filtered to
the ones a small, CMMC Level 1-fit business can actually bid on.

Confirm your subscription:
  ${input.confirmUrl}

If you didn't sign up, ignore this email — we won't add you to anything
until you click the link above.

Unsubscribe at any time:
  ${input.unsubscribeUrl}

— Custodia
Pittsburgh, PA · Veteran-owned · CMU built
`;
}

function renderHtml(input: {
  confirmUrl: string;
  unsubscribeUrl: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Confirm your Monday Bid Digest subscription</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#08201a;padding:24px 32px;color:#bdf2cf;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Custodia · Monday Bid Digest</div>
              <div style="margin-top:4px;font-size:13px;color:#8dd2b1;">Weekly federal opportunities for small CMMC L1 contractors.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#0f172a;">One more click to confirm.</h1>
              <p style="margin:0 0 16px 0;font-size:15px;">
                Every Monday at 7am ET, we'll send you a short digest of brand-new
                SAM.gov opportunities that match the NAICS codes you picked &mdash; filtered
                to the ones a small, CMMC Level 1-fit business can actually bid on.
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;">
                Confirm your subscription with a single click:
              </p>
              <p style="margin:0 0 24px 0;text-align:center;">
                <a href="${input.confirmUrl}" style="display:inline-block;background:#2f8f6d;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px;font-size:15px;">Confirm subscription</a>
              </p>
              <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;">
                If the button doesn't work, paste this link into your browser:<br />
                <a href="${input.confirmUrl}" style="color:#2f8f6d;word-break:break-all;">${input.confirmUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#64748b;">
                Didn't sign up? Ignore this email &mdash; we won't add you to anything
                until you click the link above. To unsubscribe immediately,
                <a href="${input.unsubscribeUrl}" style="color:#64748b;">click here</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center;">
              Custodia &middot; Pittsburgh, PA &middot; Veteran-owned &middot; CMU built
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
