import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureOrgForUser } from "@/lib/assessment";
import {
  CONNECTORS,
  isConnectorConfigured,
  redirectUri,
} from "@/lib/connectors/registry";
import { randomBytes } from "node:crypto";

/**
 * Start the Microsoft 365 OAuth (Authorization Code) flow.
 *
 * If the platform has not yet been configured with Azure App Registration
 * credentials, this returns a JSON response with the missing env vars and
 * setup steps the platform owner needs to complete. Once configured, it
 * redirects the user to login.microsoftonline.com with a CSRF state
 * cookie pinned to their org.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { configured, missing } = isConnectorConfigured("m365");
  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        error: "connector_not_configured",
        provider: "m365",
        missing,
        setup: {
          docs: "https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app",
          summary:
            "Register a Custodia app in Azure AD, then set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID.",
          redirectUri: redirectUri(req, "m365"),
        },
      },
      { status: 503 },
    );
  }

  const org = await ensureOrgForUser(userId);
  const cfg = CONNECTORS.m365;
  const state = `${org.id}.${randomBytes(16).toString("hex")}`;
  const tenant = process.env.MICROSOFT_TENANT_ID!;

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
  );
  authUrl.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri(req, "m365"));
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", cfg.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("custodia_oauth_state_m365", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
