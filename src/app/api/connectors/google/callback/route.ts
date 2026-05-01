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
 * Google Workspace OAuth callback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  if (errorParam) {
    const dest = new URL("/dashboard", req.url);
    dest.searchParams.set("connector_error", "google");
    dest.searchParams.set("reason", errorParam);
    return NextResponse.redirect(dest);
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const cookieState = req.headers.get("cookie")?.match(/custodia_oauth_state_google=([^;]+)/)?.[1];
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: "Invalid state (possible CSRF)" }, { status: 400 });
  }

  const org = await ensureOrgForUser(userId);
  if (state.split(".")[0] !== org.id) {
    return NextResponse.json({ error: "State org mismatch" }, { status: 400 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(req, "google_workspace"),
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("[connectors/google] token exchange failed", tokenRes.status, body);
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
    provider: "google_workspace",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    scopes: token.scope ? token.scope.split(" ") : [...CONNECTORS.google_workspace.scopes],
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    accountLabel: null,
  });

  await recordAuditEvent({
    action: "connector.connected",
    userId,
    organizationId: org.id,
    resourceType: "connector",
    resourceId: "google_workspace",
    metadata: { provider: "google_workspace" },
    ...auditContextFromRequest(req),
  });

  const dest = new URL("/dashboard", req.url);
  dest.searchParams.set("connector_connected", "google");
  const res = NextResponse.redirect(dest);
  res.cookies.delete("custodia_oauth_state_google");
  return res;
}
