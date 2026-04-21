import { NextRequest, NextResponse } from "next/server";
import { sql, initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, company } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    await initDb();

    await sql`
      INSERT INTO waitlist (email, name, company)
      VALUES (${email.toLowerCase().trim()}, ${name ?? null}, ${company ?? null})
      ON CONFLICT (email) DO NOTHING
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
