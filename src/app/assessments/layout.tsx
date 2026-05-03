import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import { countUnreadOfficerRepliesForOrg } from "@/lib/escalations";
import { WorkspaceBottomNav } from "./_components/WorkspaceBottomNav";
import { MobileCharlieFAB } from "./_components/MobileCharlieFAB";
import { DesktopCharlieRail } from "./_components/DesktopCharlieRail";

export default async function AssessmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");
  if (!has({ plan: "user:cmmc_lv1_full_access" })) redirect("/upgrade");

  const org = await ensureOrgForUser(userId);
  const unreadOfficerReplies = await countUnreadOfficerRepliesForOrg(org.id);

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header
        className="sticky top-0 z-30 border-b border-[#cfe3d9] bg-white/95 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-6 md:px-6">
          <Link href="/assessments" className="flex items-center gap-2 md:gap-3 min-w-0">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-8 w-auto md:h-9"
            />
            <span className="font-serif text-xl font-bold tracking-tight text-[#0f2f26] md:text-2xl">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </span>
            <span className="hidden border-l border-[#cfe3d9] pl-3 font-serif text-sm font-bold text-[#10231d] lg:inline">
              CMMC Level 1 workspace
            </span>
          </Link>
          {/* Desktop nav — hidden below lg (bottom nav takes over) */}
          <nav className="hidden items-center gap-3 text-sm lg:flex">
            <Link
              href="/opportunities"
              className=" px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Opportunities
            </Link>
            <Link
              href="/profile/bid-ready"
              className=" px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Bid profile
            </Link>
            <Link
              href="/assessments/connections"
              className=" px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Connections
            </Link>
            <Link
              href="/assessments/tickets"
              className="relative  px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Tickets
              {unreadOfficerReplies > 0 && (
                <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadOfficerReplies}
                </span>
              )}
            </Link>
            <Link
              href="/"
              className=" px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Home
            </Link>
            <div className="h-6 w-px bg-[#cfe3d9]" />
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </nav>
          {/* Mobile/tablet header right side: just the user button */}
          <div className="flex items-center gap-3 lg:hidden">
            {unreadOfficerReplies > 0 ? (
              <Link
                href="/assessments/tickets"
                className="relative flex h-8 w-8 items-center justify-center text-[#456c5f]"
                aria-label={`Tickets (${unreadOfficerReplies} unread)`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                  {unreadOfficerReplies > 9 ? "9+" : unreadOfficerReplies}
                </span>
              </Link>
            ) : null}
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </div>
      </header>
      <div className="flex">
        <div
          className="min-w-0 flex-1 lg:pb-0"
          style={{ paddingBottom: "calc(64px + var(--safe-bottom))" }}
        >
          {children}
        </div>
        {/* Compliance officer rail — desktop only. Below lg the workspace gets a bottom nav instead. */}
        <DesktopCharlieRail />
      </div>
      {/* Mobile/tablet bottom tab bar */}
      <WorkspaceBottomNav unreadTickets={unreadOfficerReplies} />
      {/* Mobile/tablet Charlie FAB → bottom sheet */}
      <MobileCharlieFAB />
    </div>
  );
}
