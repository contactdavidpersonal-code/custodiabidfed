import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureOrgForUser, getActiveOrgFromAuth } from "@/lib/assessment";
import { hasMspAccess } from "@/lib/billing/plans";
import {
  inviteUrl,
  listIntakeInvitationsForOrg,
} from "@/lib/intake-invitations";
import { ClientsPanel } from "./ClientsPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { userId, has, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  const isMsp = hasMspAccess(has);
  if (!isMsp) redirect("/assessments");

  const org = orgId
    ? (await getActiveOrgFromAuth()) ?? (await ensureOrgForUser(userId))
    : await ensureOrgForUser(userId);

  const rows = await listIntakeInvitationsForOrg(org.id);
  const invitations = rows.map((r) => ({
    id: r.id,
    client_email: r.client_email,
    client_name: r.client_name,
    sections: r.sections,
    completed_sections: r.completed_sections,
    last_seen_at: r.last_seen_at,
    expires_at: r.expires_at,
    revoked_at: r.revoked_at,
    created_at: r.created_at,
    url: inviteUrl(r.token),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#10231d]">
          Client intake portal
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#3a5a4f]">
          Send a magic link to a client and let them answer Charlie&apos;s
          questions in their own browser. You&apos;ll get an email when each
          section is done. Each link is good for 14 days and is scoped to{" "}
          <strong>{org.name}</strong> only.
        </p>
      </div>
      <ClientsPanel orgName={org.name} initialInvitations={invitations} />
    </div>
  );
}
