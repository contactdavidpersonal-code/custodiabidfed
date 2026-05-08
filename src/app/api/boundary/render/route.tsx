/**
 * Boundary HTML render endpoint. Returns a self-contained HTML document
 * (inline CSS) that matches the approved visual contract in
 * public/boundary-diagram-preview.html. Used to attach to bid packets,
 * preview to clients, or print as PDF via the browser.
 */

import { auth } from "@clerk/nextjs/server";
import { renderToStaticMarkup } from "react-dom/server.edge";
import { ensureOrgForUser, getActiveOrgFromAuth } from "@/lib/assessment";
import {
  assembleBoundaryView,
  validateBoundary,
} from "@/lib/cmmc/boundary";
import { BoundaryDocument, BOUNDARY_CSS } from "@/components/boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const org = orgId
    ? (await getActiveOrgFromAuth()) ?? (await ensureOrgForUser(userId))
    : await ensureOrgForUser(userId);

  const view = await assembleBoundaryView({
    organizationId: org.id,
    legalEntity: {
      id: org.id,
      name: org.name,
      cage: org.cage_code ?? null,
      uei: org.sam_uei ?? null,
      naics: org.naics_codes ?? [],
    },
  });
  const findings = validateBoundary(view);

  const body = renderToStaticMarkup(
    <BoundaryDocument view={view} findings={findings} />,
  );

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>FCI Boundary — ${escapeHtml(view.legal_entity.name)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>${BOUNDARY_CSS}</style>
</head>
<body>${body}</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
