import { NextRequest, NextResponse } from "next/server";
import { ensureDbReady, getSql } from "@/lib/db";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

const MAX_NAME_LEN = 200;
const MAX_COMPANY_LEN = 200;
const MAX_EMAIL_LEN = 254;

export async function POST(req: NextRequest) {
  try {
    await ensureDbReady();

    // Anti-spam: 10 signups per IP per hour. Waitlist is unauthenticated so
    // we key on IP; spammers cycling IPs can still get through but at much
    // higher cost.
    const rl = await checkRateLimit(
      rateLimitKey({ scope: "waitlist", req }),
      { max: 10, windowSec: 60 * 60 },
    );
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : null;
    const company =
      typeof body?.company === "string" ? body.company.trim() : null;

    if (!email) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (email.length > MAX_EMAIL_LEN) {
      return NextResponse.json({ error: "Email too long" }, { status: 400 });
    }
    if (name && name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }
    if (company && company.length > MAX_COMPANY_LEN) {
      return NextResponse.json({ error: "Company too long" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const sql = getSql();
    await sql`
      INSERT INTO waitlist (email, name, company)
      VALUES (${email.toLowerCase()}, ${name}, ${company})
      ON CONFLICT (email) DO NOTHING
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
