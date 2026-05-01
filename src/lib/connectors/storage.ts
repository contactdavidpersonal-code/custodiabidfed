/**
 * Persistence helpers for OAuth connector tokens. Tokens are encrypted
 * with AES-256-GCM at rest (see src/lib/security/connector-crypto.ts).
 */

import { ensureDbReady, getSql } from "@/lib/db";
import {
  encryptSecret,
  decryptSecret,
} from "@/lib/security/connector-crypto";
import type { ConnectorProvider } from "./types";

export type ConnectorTokenRow = {
  id: string;
  organization_id: string;
  provider: ConnectorProvider;
  account_label: string | null;
  scopes: string[];
  expires_at: string | null;
  connected_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type SaveTokenInput = {
  organizationId: string;
  provider: ConnectorProvider;
  accessToken: string;
  refreshToken?: string | null;
  scopes: string[];
  expiresAt?: Date | null;
  accountLabel?: string | null;
};

export async function saveConnectorToken(input: SaveTokenInput): Promise<void> {
  await ensureDbReady();
  const sql = getSql();
  const encAccess = encryptSecret(input.accessToken);
  const encRefresh = input.refreshToken ? encryptSecret(input.refreshToken) : null;
  await sql`
    INSERT INTO connector_tokens
      (organization_id, provider, account_label, encrypted_access_token,
       encrypted_refresh_token, scopes, expires_at, connected_at)
    VALUES
      (${input.organizationId}::uuid, ${input.provider},
       ${input.accountLabel ?? null}, ${encAccess},
       ${encRefresh}, ${input.scopes},
       ${input.expiresAt ? input.expiresAt.toISOString() : null}, NOW())
    ON CONFLICT (organization_id, provider) DO UPDATE SET
      account_label = EXCLUDED.account_label,
      encrypted_access_token = EXCLUDED.encrypted_access_token,
      encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token,
                                         connector_tokens.encrypted_refresh_token),
      scopes = EXCLUDED.scopes,
      expires_at = EXCLUDED.expires_at,
      connected_at = NOW(),
      revoked_at = NULL
  `;
}

export async function getConnectorTokenStatus(
  organizationId: string,
): Promise<ReadonlyArray<ConnectorTokenRow>> {
  await ensureDbReady();
  const sql = getSql();
  return (await sql`
    SELECT id, organization_id, provider, account_label, scopes,
           expires_at, connected_at, last_used_at, revoked_at
    FROM connector_tokens
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY connected_at DESC
  `) as ConnectorTokenRow[];
}

export async function readConnectorAccessToken(
  organizationId: string,
  provider: ConnectorProvider,
): Promise<{ accessToken: string; refreshToken: string | null } | null> {
  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT encrypted_access_token, encrypted_refresh_token
    FROM connector_tokens
    WHERE organization_id = ${organizationId}::uuid
      AND provider = ${provider}
      AND revoked_at IS NULL
    LIMIT 1
  `) as Array<{ encrypted_access_token: string; encrypted_refresh_token: string | null }>;
  const row = rows[0];
  if (!row) return null;
  return {
    accessToken: decryptSecret(row.encrypted_access_token),
    refreshToken: row.encrypted_refresh_token
      ? decryptSecret(row.encrypted_refresh_token)
      : null,
  };
}

export async function revokeConnectorToken(
  organizationId: string,
  provider: ConnectorProvider,
): Promise<void> {
  await ensureDbReady();
  const sql = getSql();
  await sql`
    UPDATE connector_tokens
    SET revoked_at = NOW()
    WHERE organization_id = ${organizationId}::uuid
      AND provider = ${provider}
      AND revoked_at IS NULL
  `;
}
