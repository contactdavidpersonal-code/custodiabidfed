import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export const runtime = "nodejs";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

/**
 * GET /api/bid-digest/confirm?token=...
 *
 * Single-use confirmation link. Sets confirmed_at to NOW() if the token
 * matches an unconfirmed row. Redirects to a friendly page in either
 * case — we don't reveal whether the token was already used.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token");
  const redirect = (status: "ok" | "invalid") =>
    NextResponse.redirect(`${APP_URL}/bid-digest/confirmed?s=${status}`, 303);

  if (!token || token.length < 16 || token.length > 128) {
    return redirect("invalid");
  }

  await initDb();
  const sql = getSql();
  const rows = (await sql`
    UPDATE bid_digest_subscribers
    SET confirmed_at = NOW()
    WHERE confirm_token = ${token} AND confirmed_at IS NULL
    RETURNING id
  `) as Array<{ id: number }>;

  return redirect(rows.length > 0 ? "ok" : "invalid");
}
