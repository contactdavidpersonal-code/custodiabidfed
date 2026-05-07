/**
 * Isolated storage for the public CMMC Check tool.
 *
 * This file is the ONLY place /cmmc-check writes to the database. It owns
 * one table — `cmmc_check_sessions` — and never reads or joins to anything
 * else in the schema. That isolation is intentional: the public chat must
 * not be able to leak customer data even if the model is fully compromised
 * by prompt injection, because no record outside this table is reachable
 * through any code path it controls.
 *
 * Schema summary:
 *   - token: 32-byte hex (256-bit) unguessable, used in the public report URL
 *   - transcript: full chat as JSONB array of { role, content }
 *   - result: parsed CmmcCheckResult once finalized (NULL until finalized)
 *   - contact_email: optional, mirrors result.contactEmail for indexing
 *   - turn_count: hard cap enforced at the API layer
 *   - ip / user_agent: forensic + abuse triage only
 *   - created_at / updated_at / finalized_at: lifecycle
 *
 * The table self-creates lazily on first use via `ensureCmmcCheckTable()` so
 * we don't have to amend `runInitDdl()` and risk merging with unrelated
 * migrations.
 */

import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import type { CmmcCheckResult } from "@/lib/cmmc/applicability";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type CmmcCheckSession = {
  token: string;
  transcript: ChatTurn[];
  result: CmmcCheckResult | null;
  contactEmail: string | null;
  turnCount: number;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Hard cap on conversation turns (user+assistant pairs). Any session that
 *  hits this limit is forced into wrap-up mode by the API layer. */
export const MAX_TURNS = 30;

let _tableReady: Promise<void> | null = null;

export function ensureCmmcCheckTable(): Promise<void> {
  if (_tableReady) return _tableReady;
  _tableReady = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS cmmc_check_sessions (
        token TEXT PRIMARY KEY,
        transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
        result JSONB,
        contact_email TEXT,
        turn_count INTEGER NOT NULL DEFAULT 0,
        ip TEXT,
        user_agent TEXT,
        finalized_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS cmmc_check_sessions_email_idx
        ON cmmc_check_sessions (contact_email)
        WHERE contact_email IS NOT NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS cmmc_check_sessions_finalized_idx
        ON cmmc_check_sessions (finalized_at DESC)
        WHERE finalized_at IS NOT NULL
    `;
  })().catch((err) => {
    _tableReady = null;
    throw err;
  });
  return _tableReady;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(input: {
  ip: string | null;
  userAgent: string | null;
}): Promise<string> {
  await ensureCmmcCheckTable();
  const sql = getSql();
  const token = newSessionToken();
  await sql`
    INSERT INTO cmmc_check_sessions (token, ip, user_agent)
    VALUES (${token}, ${input.ip}, ${input.userAgent})
  `;
  return token;
}

export async function getSession(
  token: string,
): Promise<CmmcCheckSession | null> {
  if (!isValidToken(token)) return null;
  await ensureCmmcCheckTable();
  const sql = getSql();
  const rows = (await sql`
    SELECT token, transcript, result, contact_email, turn_count,
           finalized_at, created_at, updated_at
    FROM cmmc_check_sessions
    WHERE token = ${token}
    LIMIT 1
  `) as Array<{
    token: string;
    transcript: unknown;
    result: unknown;
    contact_email: string | null;
    turn_count: number;
    finalized_at: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
  }>;
  const r = rows[0];
  if (!r) return null;
  return {
    token: r.token,
    transcript: Array.isArray(r.transcript) ? (r.transcript as ChatTurn[]) : [],
    result: (r.result ?? null) as CmmcCheckResult | null,
    contactEmail: r.contact_email,
    turnCount: Number(r.turn_count ?? 0),
    finalizedAt: r.finalized_at ? new Date(r.finalized_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export async function appendTurns(
  token: string,
  turns: ChatTurn[],
): Promise<void> {
  if (!isValidToken(token)) throw new Error("Invalid session token");
  if (turns.length === 0) return;
  await ensureCmmcCheckTable();
  const sql = getSql();
  await sql`
    UPDATE cmmc_check_sessions
    SET transcript = transcript || ${JSON.stringify(turns)}::jsonb,
        turn_count = turn_count + ${turns.length},
        updated_at = NOW()
    WHERE token = ${token}
  `;
}

export async function finalizeSession(
  token: string,
  result: CmmcCheckResult,
): Promise<void> {
  if (!isValidToken(token)) throw new Error("Invalid session token");
  await ensureCmmcCheckTable();
  const sql = getSql();
  await sql`
    UPDATE cmmc_check_sessions
    SET result = ${JSON.stringify(result)}::jsonb,
        contact_email = ${result.contactEmail},
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE token = ${token}
  `;
}

/** 64 hex chars = 256 bits. Anything else is a malformed/forged token. */
export function isValidToken(token: string): boolean {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}
