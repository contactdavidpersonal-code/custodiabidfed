import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getManagedOrgsStatus } from "@/lib/billing/managed-orgs";

/**
 * GET /api/billing/managed-orgs
 *
 * Returns the signed-in user's managed-orgs cap, current count, plan, and
 * whether they can add another business. Used by the OrgSwitcher to render
 * the "you're at capacity" nag and the upgrade CTA.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const status = await getManagedOrgsStatus(userId);
    return NextResponse.json(status);
  } catch (err) {
    console.error("[billing/managed-orgs] failed", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }
}
