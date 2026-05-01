import { NextResponse } from "next/server";
import { ensureDbReady, getSql } from "@/lib/db";
import {
  parseQuizAnswers,
  scoreQuiz,
  QUIZ_QUESTIONS,
} from "@/lib/cmmc/sprs-scoring";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

/**
 * Public, unauthenticated SPRS-style self-check quiz submission.
 *
 * Lead-gen flow:
 *   1. Visitor fills 12 questions on /sprs-check
 *   2. POST { answers, email?, companyName?, naics?, utm }
 *   3. We compute SPRS-style score + per-control gap list
 *   4. Persist for sales follow-up; return result for the gap report page
 *
 * Rate limited per-IP because this is unauthenticated. No PII other than
 * what the visitor explicitly provides.
 */
export async function POST(req: Request) {
  // Defense-in-depth rate limit: 20 submissions per hour per IP.
  const rl = await checkRateLimit(
    rateLimitKey({ scope: "sprs-quiz", req }),
    { max: 20, windowSec: 3600 },
  );
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  let answers;
  try {
    answers = parseQuizAnswers(b.answers);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid answers" },
      { status: 400 },
    );
  }

  if (Object.keys(answers).length !== QUIZ_QUESTIONS.length) {
    return NextResponse.json(
      { error: "All questions must be answered." },
      { status: 400 },
    );
  }

  const result = scoreQuiz(answers);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : null;
  const companyName =
    typeof b.companyName === "string" ? b.companyName.trim().slice(0, 200) : null;
  const naicsArr =
    Array.isArray(b.naics) && b.naics.every((x) => typeof x === "string")
      ? (b.naics as string[]).slice(0, 6)
      : null;
  const utmSource =
    typeof b.utmSource === "string" ? b.utmSource.slice(0, 80) : null;

  // Persist for lifecycle/CRM. We don't fail the request if DB write
  // fails — the visitor still deserves their result.
  try {
    await ensureDbReady();
    const sql = getSql();
    const fwd = req.headers.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
    const ua = req.headers.get("user-agent");
    await sql`
      INSERT INTO sprs_quiz_submissions
        (email, company_name, naics_codes, answers, score, max_score,
         gap_summary, utm_source, ip, user_agent)
      VALUES
        (${email}, ${companyName}, ${naicsArr},
         ${JSON.stringify(answers)}::jsonb,
         ${result.score}, ${result.maxScore},
         ${JSON.stringify({ gaps: result.gaps })}::jsonb,
         ${utmSource}, ${ip}, ${ua})
    `;
  } catch (err) {
    console.warn("[sprs-quiz] persist failed:", err);
  }

  return NextResponse.json({ ok: true, result });
}
