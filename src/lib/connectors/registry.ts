/**
 * Connector registry — lookup, configuration, and OAuth metadata for the
 * evidence-source integrations Custodia ships. Keep a single source of
 * truth so the start/callback routes, the dashboard "Connect" UI, and
 * the manual-evidence path all read from the same place.
 */

import type { ConnectorProvider } from "./types";

export type ConnectorConfig = {
  provider: ConnectorProvider;
  label: string;
  /** Marketing tagline — shown on the connect card. */
  tagline: string;
  /** OAuth scopes we request. Read-only / least-privilege. */
  scopes: ReadonlyArray<string>;
  /** Required env vars; if any are missing the start route returns setup
   *  instructions instead of redirecting to the IdP. */
  requiredEnv: ReadonlyArray<string>;
  /** Per-control evidence the connector can produce automatically. */
  controlsCovered: ReadonlyArray<string>;
};

export const CONNECTORS: Record<ConnectorProvider, ConnectorConfig> = {
  m365: {
    provider: "m365",
    label: "Microsoft 365",
    tagline:
      "Connect Entra ID + Microsoft 365 admin to auto-collect MFA, password, and access-control evidence.",
    scopes: [
      "User.Read.All",
      "AuditLog.Read.All",
      "Policy.Read.All",
      "Reports.Read.All",
      "offline_access",
    ],
    requiredEnv: [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID",
    ],
    controlsCovered: [
      "AC.L1-3.1.1",
      "AC.L1-3.1.2",
      "IA.L1-3.5.1",
      "IA.L1-3.5.2",
    ],
  },
  google_workspace: {
    provider: "google_workspace",
    label: "Google Workspace",
    tagline:
      "Connect your Google Workspace admin to auto-collect user inventory, 2-Step Verification status, and audit logs.",
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
      "https://www.googleapis.com/auth/admin.reports.audit.readonly",
      "https://www.googleapis.com/auth/admin.directory.domain.readonly",
    ],
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    controlsCovered: [
      "AC.L1-3.1.1",
      "AC.L1-3.1.2",
      "IA.L1-3.5.1",
      "IA.L1-3.5.2",
    ],
  },
};

export function isConnectorConfigured(
  provider: ConnectorProvider,
): { configured: boolean; missing: string[] } {
  const cfg = CONNECTORS[provider];
  const missing = cfg.requiredEnv.filter((v) => !process.env[v]);
  return { configured: missing.length === 0, missing };
}

/** Browser-safe origin for OAuth redirects. Honors NEXT_PUBLIC_APP_URL,
 *  falls back to the request URL. */
export function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function redirectUri(req: Request, provider: ConnectorProvider): string {
  return `${appOrigin(req)}/api/connectors/${
    provider === "google_workspace" ? "google" : provider
  }/callback`;
}
