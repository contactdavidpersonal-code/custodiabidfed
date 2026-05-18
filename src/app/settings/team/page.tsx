import { auth, clerkClient } from "@clerk/nextjs/server";
import { OrganizationProfile, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrgFromAuth } from "@/lib/assessment";
import { designateSeniorOfficialAction } from "@/app/assessments/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team & Senior Official · Custodia",
};

type Member = {
  userId: string;
  identifier: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: string;
};

async function loadMembers(clerkOrgId: string): Promise<Member[]> {
  const cc = await clerkClient();
  const list = await cc.organizations.getOrganizationMembershipList({
    organizationId: clerkOrgId,
  });
  return list.data.map((m) => ({
    userId: m.publicUserData?.userId ?? "",
    identifier: m.publicUserData?.identifier ?? "",
    firstName: m.publicUserData?.firstName ?? null,
    lastName: m.publicUserData?.lastName ?? null,
    imageUrl: m.publicUserData?.imageUrl ?? null,
    role: m.role,
  }));
}

function displayName(m: Member): string {
  const composed = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  return composed || m.identifier;
}

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ designated?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await getActiveOrgFromAuth();
  if (!org) redirect("/onboard");

  const params = (await searchParams) ?? {};
  const justDesignated = params.designated === "1";

  const isCurrentSO = org.senior_official_user_id === userId;
  const hasClerkOrg = Boolean(org.clerk_org_id);

  let members: Member[] = [];
  let currentSoMember: Member | null = null;
  if (hasClerkOrg) {
    try {
      members = await loadMembers(org.clerk_org_id!);
      currentSoMember =
        members.find((m) => m.userId === org.senior_official_user_id) ?? null;
    } catch (err) {
      console.error("[team-settings] failed to load members", err);
    }
  }

  return (
    <div className="min-h-screen bg-[#e9efea] text-[#10231d]">
      <header
        className="sticky top-0 z-30 border-b border-[#cfe3d9] bg-white/95 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-xs tracking-[0.2em] uppercase text-[#2f8f6d]">
              Custodia · Settings
            </span>
            <span className="font-serif text-xl font-bold tracking-tight text-[#10231d] md:text-2xl">
              Team &amp; Senior Official
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/assessments"
              className="hidden text-sm font-medium text-[#456c5f] hover:text-[#10231d] sm:inline"
            >
              ← Back to workspace
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {justDesignated ? (
          <div className="mb-6 rounded-md border border-[#cfe3d9] bg-white px-4 py-3 text-sm text-[#10231d]">
            <span className="font-semibold text-[#2f8f6d]">Designation transferred.</span>{" "}
            The new Senior Official will be asked to acknowledge their role the next time they
            open the workspace.
          </div>
        ) : null}

        <section className="mb-10">
          <p className="mb-2 font-serif text-xs tracking-[0.2em] uppercase text-[#2f8f6d]">
            Current Senior Official
          </p>
          <div className="rounded-lg border border-[#cfe3d9] bg-white p-5">
            {currentSoMember ? (
              <div className="flex items-center gap-4">
                {currentSoMember.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSoMember.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded-full border border-[#cfe3d9]"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#bdf2cf] font-serif text-lg font-bold text-[#0e2a23]">
                    {displayName(currentSoMember).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-serif text-lg font-bold text-[#10231d]">
                    {displayName(currentSoMember)}
                    {currentSoMember.userId === userId ? (
                      <span className="ml-2 rounded-full bg-[#bdf2cf] px-2 py-0.5 align-middle text-xs font-semibold text-[#0e2a23]">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-[#456c5f]">
                    {currentSoMember.identifier}
                  </p>
                  <p className="mt-1 text-xs text-[#456c5f]">
                    Personally responsible under 32 CFR § 170.21(a)(2) for the CMMC Level 1
                    affirmation filed from this workspace.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#456c5f]">
                {org.senior_official_user_id === userId
                  ? "You are the Senior Official for this workspace."
                  : "A Senior Official is designated but is not currently a member of the linked Clerk organization."}
              </p>
            )}
          </div>
        </section>

        {!hasClerkOrg ? (
          <section className="mb-10 rounded-lg border border-[#cfe3d9] bg-white p-5">
            <p className="font-serif text-xs tracking-[0.2em] uppercase text-[#2f8f6d]">
              Team workspace not yet set up
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
              Add teammates by creating a team workspace
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#456c5f]">
              This account is operating on a personal workspace. To invite teammates and
              transfer Senior Official designation, create a team workspace from the
              organization switcher in the header.
            </p>
            <Link
              href="/assessments"
              className="mt-4 inline-flex items-center rounded-md bg-[#0e2a23] px-4 py-2 text-sm font-semibold text-[#bdf2cf] hover:bg-[#10231d]"
            >
              Go to workspace
            </Link>
          </section>
        ) : (
          <>
            {isCurrentSO ? (
              <section className="mb-10">
                <p className="mb-2 font-serif text-xs tracking-[0.2em] uppercase text-[#2f8f6d]">
                  Transfer Senior Official designation
                </p>
                <div className="rounded-lg border border-[#cfe3d9] bg-white p-5">
                  <p className="text-sm leading-relaxed text-[#456c5f]">
                    Only you can transfer this responsibility. The new Senior Official will be
                    required to acknowledge 32 CFR § 170.21(a)(2) before they can sign any
                    affirmation. Until they do, the existing affirmation gate remains on you.
                  </p>
                  {members.filter((m) => m.userId !== userId).length === 0 ? (
                    <p className="mt-4 text-sm text-[#456c5f]">
                      No other members yet. Invite a teammate below first, then return here to
                      transfer.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-[#e9efea]">
                      {members
                        .filter((m) => m.userId !== userId && m.userId !== "")
                        .map((m) => (
                          <li
                            key={m.userId}
                            className="flex items-center justify-between gap-4 py-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {m.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.imageUrl}
                                  alt=""
                                  className="h-9 w-9 rounded-full border border-[#cfe3d9]"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9efea] font-serif text-sm font-bold text-[#0e2a23]">
                                  {displayName(m).charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#10231d]">
                                  {displayName(m)}
                                </p>
                                <p className="truncate text-xs text-[#456c5f]">
                                  {m.identifier} · {m.role.replace(/^org:/, "")}
                                </p>
                              </div>
                            </div>
                            <form action={designateSeniorOfficialAction}>
                              <input
                                type="hidden"
                                name="targetUserId"
                                value={m.userId}
                              />
                              <button
                                type="submit"
                                className="rounded-md border border-[#0e2a23] bg-white px-3 py-1.5 text-xs font-semibold text-[#0e2a23] hover:bg-[#0e2a23] hover:text-[#bdf2cf]"
                              >
                                Designate as Senior Official
                              </button>
                            </form>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : (
              <section className="mb-10 rounded-lg border border-[#cfe3d9] bg-white p-5">
                <p className="font-serif text-xs tracking-[0.2em] uppercase text-[#2f8f6d]">
                  Senior Official transfer
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#456c5f]">
                  Only the current Senior Official may transfer the designation. Ask{" "}
                  <span className="font-semibold text-[#10231d]">
                    {currentSoMember ? displayName(currentSoMember) : "the current SO"}
                  </span>{" "}
                  to sign in and reassign from this page if needed.
                </p>
              </section>
            )}

            <section>
              <p className="mb-2 font-serif text-xs tracking-[0.2em] uppercase text-[#2f8f6d]">
                Invite teammates &amp; manage members
              </p>
              <div className="overflow-hidden rounded-lg border border-[#cfe3d9] bg-white">
                <OrganizationProfile
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      cardBox: "shadow-none border-0",
                      navbar: "hidden",
                      navbarMobileMenuButton: "hidden",
                      pageScrollBox: "p-4 md:p-6",
                    },
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-[#456c5f]">
                Invited teammates can collaborate on evidence and assessment work, but only
                the designated Senior Official can sign the SPRS affirmation. All designation
                changes are written to the security audit log.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
