/**
 * FCI Boundary workspace page. Server component shell — fetches the
 * assembled BoundaryView + findings, then hands off to the client editor
 * for inline editing of flows / out-of-scope / affirming official.
 *
 * Visual contract: matches public/boundary-diagram-preview.html exactly.
 */

import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrgFromAuth } from "@/lib/assessment";
import {
  assembleBoundaryView,
  validateBoundary,
} from "@/lib/cmmc/boundary";
import { BOUNDARY_CSS } from "@/components/boundary";
import { BoundaryEditor } from "./BoundaryEditor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BoundaryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const org = (await getActiveOrgFromAuth())!;

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <style dangerouslySetInnerHTML={{ __html: BOUNDARY_CSS }} />
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            CMMC L1 · Boundary
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
            FCI Boundary diagram &amp; SSP § 1.2
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
            One page that defines what is in scope, what is out, and who signs.
            Edit on the right; the diagram and validation update on save.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/boundary/render"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-[#0e2a23] bg-[#0e2a23] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#10231d]"
          >
            Open standalone HTML
          </a>
          <Link
            href="/assessments"
            className="inline-flex items-center gap-2 border border-[#cfe3d9] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#10231d] hover:bg-[#f1f6f3]"
          >
            ← Back to workspace
          </Link>
        </div>
      </div>

      <BoundaryEditor initialView={view} initialFindings={findings} />
    </div>
  );
}
