import { NextRequest, NextResponse } from "next/server";
import { getSql, initDb } from "@/lib/db";

export const runtime = "nodejs";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

async function handle(token: string | null): Promise<NextResponse> {
  const redirect = (status: "ok" | "invalid") =>
    NextResponse.redirect(`${APP_URL}/bid-digest/unsubscribed?s=${status}`, 303);

  if (!token || token.length < 16 || token.length > 128) {
    return redirect("invalid");
  }

  await initDb();
  const sql = getSql();
  const rows = (await sql`
    UPDATE bid_digest_subscribers
    SET unsubscribed_at = NOW()
    WHERE unsubscribe_token = ${token}
    RETURNING id
  `) as Array<{ id: number }>;

  return redirect(rows.length > 0 ? "ok" : "invalid");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req.nextUrl.searchParams.get("token"));
}

// RFC 8058 one-click List-Unsubscribe support.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req.nextUrl.searchParams.get("token"));
}
