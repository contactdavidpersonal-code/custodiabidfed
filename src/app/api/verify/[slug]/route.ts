import { NextResponse } from "next/server";
import { ensureDbReady, getSql } from "@/lib/db";
import {
  checkRateLimit,
  rateLimitKey,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyRow = {
  organization_name: string;
  sam_uei: string | null;
  cage_code: string | null;
  custodia_verification_id: string | null;
  is_public: boolean;
  health: "green" | "amber" | "red" | "gray" | null;
  last_computed_at: string | null;
  next_reaffirm_due: string | null;
  affirmation_filed_at: string | null;
  sprs_filed_at: string | null;
};

/**
 * Public verification JSON — used by primes, partners, and machine clients
 * to confirm the live state of a Verified page without scraping HTML.
 * Rate-limited per IP. Never exposes the SPRS confirmation number.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  const limit = await checkRateLimit(
    rateLimitKey({ scope: "verify", req }),
    { max: 60, windowSec: 60 },
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT o.name AS organization_name,
           o.sam_uei,
           o.cage_code,
           t.custodia_verification_id,
           t.is_public,
           ts.health,
           ts.last_computed_at,
           ts.next_reaffirm_due,
           ts.affirmation_filed_at,
           latest.sprs_filed_at
    FROM trust_pages t
    JOIN organizations o ON o.id = t.organization_id
    LEFT JOIN trust_status ts ON ts.organization_id = t.organization_id
    LEFT JOIN LATERAL (
      SELECT a.sprs_filed_at
      FROM assessments a
      WHERE a.organization_id = t.organization_id
        AND a.sprs_filed_at IS NOT NULL
      ORDER BY a.sprs_filed_at DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE (t.verification_slug = ${slug} OR t.slug = ${slug})
    LIMIT 1
  `) as VerifyRow[];

  const row = rows[0];
  if (!row || !row.is_public) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      orgName: row.organization_name,
      uei: row.sam_uei,
      cage: row.cage_code,
      custodiaVerificationId: row.custodia_verification_id,
      framework: "CMMC Level 1 (FAR 52.204-21)",
      affirmationFiledAt: row.affirmation_filed_at ?? row.sprs_filed_at,
      sprsFiledAt: row.sprs_filed_at,
      nextReaffirmDue: row.next_reaffirm_due,
      health: row.health ?? "gray",
      lastVerifiedAt: row.last_computed_at,
      // SPRS confirmation number is intentionally NEVER returned.
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
