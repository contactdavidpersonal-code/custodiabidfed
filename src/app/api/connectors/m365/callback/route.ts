import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureOrgForUser } from "@/lib/assessment";
import { CONNECTORS, redirectUri } from "@/lib/connectors/registry";
import { saveConnectorToken } from "@/lib/connectors/storage";
import {
  recordAuditEvent,
  auditContextFromRequest,
} from "@/lib/security/audit-log";

/**
 * Microsoft 365 OAuth callback. Verifies the CSRF state cookie, exchanges
 * the authorization code for an access + refresh token, and persists them
 * encrypted-at-rest. Redirects the user back to the dashboard.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  if (errorParam) {
    const dest = new URL("/dashboard", req.url);
    dest.searchParams.set("connector_error", "m365");
    dest.searchParams.set("reason", errorDesc ?? errorParam);
    return NextResponse.redirect(dest);
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const cookieState = req.headers.get("cookie")?.match(/custodia_oauth_state_m365=([^;]+)/)?.[1];
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: "Invalid state (possible CSRF)" }, { status: 400 });
  }

  const org = await ensureOrgForUser(userId);
  const orgIdFromState = state.split(".")[0];
  if (orgIdFromState !== org.id) {
    return NextResponse.json({ error: "State org mismatch" }, { status: 400 });
  }

  const tenant = process.env.MICROSOFT_TENANT_ID!;
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope: CONNECTORS.m365.scopes.join(" "),
        code,
        redirect_uri: redirectUri(req, "m365"),
        grant_type: "authorization_code",
      }),
    },
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("[connectors/m365] token exchange failed", tokenRes.status, body);
    return NextResponse.json(
      { error: "Token exchange failed", status: tokenRes.status },
      { status: 502 },
    );
  }

  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  await saveConnectorToken({
    organizationId: org.id,
    provider: "m365",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ? token.scope.split(" ") : [...CONNECTORS.m365.scopes],
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    accountLabel: tenant,
  });

  await recordAuditEvent({
    action: "connector.connected",
    userId,
    organizationId: org.id,
    resourceType: "connector",
    resourceId: "m365",
    metadata: { provider: "m365" },
    ...auditContextFromRequest(req),
  });

  const dest = new URL("/dashboard", req.url);
  dest.searchParams.set("connector_connected", "m365");
  const res = NextResponse.redirect(dest);
  res.cookies.delete("custodia_oauth_state_m365");
  return res;
}
