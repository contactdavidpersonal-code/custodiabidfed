import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ensureDbReady, getSql } from "@/lib/db";
import { renderBadge } from "@/lib/badge";
import type { TrustHealth } from "@/lib/trust-status";

export const runtime = "nodejs";
export const revalidate = 300;

type BadgeRow = {
  organization_name: string;
  custodia_verification_id: string | null;
  is_public: boolean;
  health: TrustHealth | null;
  last_computed_at: string | null;
};

function isWideOrSquare(v: string | null): "wide" | "square" {
  return v === "square" ? "square" : "wide";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const size = isWideOrSquare(url.searchParams.get("size"));

  await ensureDbReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT o.name AS organization_name,
           t.custodia_verification_id,
           t.is_public,
           ts.health,
           ts.last_computed_at
    FROM trust_pages t
    JOIN organizations o ON o.id = t.organization_id
    LEFT JOIN trust_status ts ON ts.organization_id = t.organization_id
    WHERE (t.verification_slug = ${slug} OR t.slug = ${slug})
    LIMIT 1
  `) as BadgeRow[];

  const row = rows[0];
  if (!row || !row.is_public) {
    return new NextResponse("Not found", { status: 404 });
  }

  const svg = renderBadge({
    orgName: row.organization_name,
    custodiaVerificationId: row.custodia_verification_id ?? "CUST-V-PENDING",
    health: row.health ?? "gray",
    lastVerifiedAt: row.last_computed_at,
    size,
  });

  const etag = `"${createHash("sha1")
    .update(`${slug}:${size}:${row.health ?? "gray"}:${row.last_computed_at ?? "0"}`)
    .digest("hex")}"`;

  // Conditional 304
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
