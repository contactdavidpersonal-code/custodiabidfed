/**
 * Admin-only Instantly smoke test.
 *
 * Verifies INSTANTLY_API_KEY by hitting two read-only endpoints:
 *   - /workspaces/current  (proves auth)
 *   - /accounts            (proves we can read account list)
 *
 * Auth: same shared-secret gate as the Hunter test.
 *       header `x-admin-secret` must match `OUTBOUND_ADMIN_SECRET` env.
 *
 * Does NOT create or modify anything. Safe to call repeatedly.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getWorkspace, listAccounts } from "@/lib/outbound/instantly";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const expected = process.env.OUTBOUND_ADMIN_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      {
        error:
          "OUTBOUND_ADMIN_SECRET is not configured (must be ≥16 chars). Refusing to expose this route.",
      },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!constantTimeEquals(provided, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const out: Record<string, unknown> = {
    ranAt: new Date().toISOString(),
  };

  try {
    out.workspace = await getWorkspace();
  } catch (err) {
    out.workspaceError = errMsg(err);
    return NextResponse.json(out, { status: 502 });
  }

  try {
    const accounts = await listAccounts();
    out.accounts = {
      count: accounts.length,
      sample: accounts.slice(0, 12).map((a) => ({
        email: a.email,
        status: a.status,
        warmupStatus: a.warmupStatus,
        dailyLimit: a.dailyLimit,
      })),
    };
  } catch (err) {
    out.accountsError = errMsg(err);
  }

  return NextResponse.json(out);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
