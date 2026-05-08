/**
 * Microsoft Graph fetcher — refreshes OAuth tokens, calls Graph endpoints
 * with paging, and returns canonical JSON payloads suitable for SHA-256
 * hashing + connector-evidence ingest.
 *
 * Scope assumptions (must match registry.ts):
 *   - User.Read.All           → /v1.0/users
 *   - Reports.Read.All        → /v1.0/reports/authenticationMethods/userRegistrationDetails
 *   - AuditLog.Read.All       → /v1.0/auditLogs/* (future)
 *   - Policy.Read.All         → /v1.0/policies/* (future)
 *   - offline_access          → refresh tokens
 *
 * Refresh flow: if expires_at is within 60s of now, POST to
 * /{tenantId}/oauth2/v2.0/token with grant_type=refresh_token. New
 * access+refresh tokens are persisted via saveConnectorToken.
 *
 * Rate limits: Graph throttles return 429 with Retry-After. We surface
 * the error to the caller and let the scheduler retry on its next tick;
 * we do NOT block-loop with sleep in a route handler.
 */

import {
  readConnectorAccessToken,
  saveConnectorToken,
} from "@/lib/connectors/storage";
import { ensureDbReady, getSql } from "@/lib/db";

const GRAPH_BASE = "https://graph.microsoft.com";
const TOKEN_BASE = "https://login.microsoftonline.com";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type ExpiryRow = { expires_at: string | null };

/**
 * Returns a usable access token. Refreshes if expired (or about to). If
 * no token is connected for the org returns null.
 */
async function getAccessToken(organizationId: string): Promise<string | null> {
  await ensureDbReady();
  const sql = getSql();
  const expRows = (await sql`
    SELECT expires_at FROM connector_tokens
    WHERE organization_id = ${organizationId}::uuid
      AND provider = 'm365'
      AND revoked_at IS NULL
    LIMIT 1
  `) as ExpiryRow[];
  const tokens = await readConnectorAccessToken(organizationId, "m365");
  if (!tokens) return null;

  const expiresAt = expRows[0]?.expires_at
    ? new Date(expRows[0].expires_at).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt - Date.now() < 60_000;
  if (!needsRefresh) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    // No refresh token — the user must reconnect via OAuth.
    return null;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET not configured",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    scope: "User.Read.All Reports.Read.All offline_access",
  });
  const res = await fetch(`${TOKEN_BASE}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`m365 token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as TokenResponse;
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000);
  await saveConnectorToken({
    organizationId,
    provider: "m365",
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? tokens.refreshToken,
    scopes: json.scope ? json.scope.split(" ") : [],
    expiresAt: newExpiresAt,
  });
  return json.access_token;
}

/**
 * Generic Graph GET with automatic OData paging via @odata.nextLink.
 * Returns the merged `value` array. Caller is responsible for typing.
 */
async function graphGetAll(
  accessToken: string,
  path: string,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let url = path.startsWith("http")
    ? path
    : `${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  let safety = 50; // hard cap on page count
  while (url && safety > 0) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ConsistencyLevel: "eventual",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `graph ${url} failed: ${res.status} ${text.slice(0, 300)}`,
      );
    }
    const body = (await res.json()) as {
      value?: unknown[];
      "@odata.nextLink"?: string;
    };
    if (Array.isArray(body.value)) out.push(...body.value);
    url = body["@odata.nextLink"] ?? "";
    safety -= 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain fetchers
// ─────────────────────────────────────────────────────────────────────────────

export type AuthorizedUserRow = {
  id: string;
  displayName: string | null;
  userPrincipalName: string | null;
  mail: string | null;
  accountEnabled: boolean | null;
  createdDateTime: string | null;
  signInActivity: {
    lastSignInDateTime: string | null;
  } | null;
};

export type FetchedAuthorizedUsers = {
  pulledAt: string;
  source: "graph.users";
  users: AuthorizedUserRow[];
};

export async function fetchAuthorizedUsers(
  organizationId: string,
): Promise<FetchedAuthorizedUsers | null> {
  const token = await getAccessToken(organizationId);
  if (!token) return null;
  const select = [
    "id",
    "displayName",
    "userPrincipalName",
    "mail",
    "accountEnabled",
    "createdDateTime",
  ].join(",");
  const raw = await graphGetAll(
    token,
    `/v1.0/users?$select=${select}&$top=999`,
  );
  const users = raw.map((u) => {
    const r = u as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      displayName: (r.displayName as string | null) ?? null,
      userPrincipalName: (r.userPrincipalName as string | null) ?? null,
      mail: (r.mail as string | null) ?? null,
      accountEnabled: (r.accountEnabled as boolean | null) ?? null,
      createdDateTime: (r.createdDateTime as string | null) ?? null,
      signInActivity: null,
    } satisfies AuthorizedUserRow;
  });
  return {
    pulledAt: new Date().toISOString(),
    source: "graph.users",
    users,
  };
}

export type MfaUserRow = {
  id: string;
  userPrincipalName: string | null;
  isMfaRegistered: boolean | null;
  isMfaCapable: boolean | null;
  defaultMfaMethod: string | null;
  methodsRegistered: string[];
};

export type FetchedMfaReport = {
  pulledAt: string;
  source: "graph.userRegistrationDetails";
  users: MfaUserRow[];
};

export async function fetchMfaReport(
  organizationId: string,
): Promise<FetchedMfaReport | null> {
  const token = await getAccessToken(organizationId);
  if (!token) return null;
  // Reports.Read.All required. Note: this endpoint is /v1.0 GA in Graph.
  const raw = await graphGetAll(
    token,
    `/v1.0/reports/authenticationMethods/userRegistrationDetails`,
  );
  const users = raw.map((u) => {
    const r = u as Record<string, unknown>;
    const methods = Array.isArray(r.methodsRegistered)
      ? (r.methodsRegistered as unknown[]).map((m) => String(m))
      : [];
    return {
      id: String(r.id ?? ""),
      userPrincipalName: (r.userPrincipalName as string | null) ?? null,
      isMfaRegistered: (r.isMfaRegistered as boolean | null) ?? null,
      isMfaCapable: (r.isMfaCapable as boolean | null) ?? null,
      defaultMfaMethod: (r.defaultMfaMethod as string | null) ?? null,
      methodsRegistered: methods,
    } satisfies MfaUserRow;
  });
  return {
    pulledAt: new Date().toISOString(),
    source: "graph.userRegistrationDetails",
    users,
  };
}
