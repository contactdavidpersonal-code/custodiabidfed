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
 * Start the Google Workspace OAuth flow. Mirrors the M365 start route.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { configured, missing } = isConnectorConfigured("google_workspace");
  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        error: "connector_not_configured",
        provider: "google_workspace",
        missing,
        setup: {
          docs: "https://support.google.com/cloud/answer/6158849",
          summary:
            "Create a Google Cloud OAuth client, enable Admin SDK + Reports API, then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
          redirectUri: redirectUri(req, "google_workspace"),
        },
      },
      { status: 503 },
    );
  }

  const org = await ensureOrgForUser(userId);
  const cfg = CONNECTORS.google_workspace;
  const state = `${org.id}.${randomBytes(16).toString("hex")}`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri(req, "google_workspace"));
  authUrl.searchParams.set("scope", cfg.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("custodia_oauth_state_google", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
