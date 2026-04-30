import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ComplianceOfficerRail } from "./ComplianceOfficerRail";

export default async function AssessmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");
  if (!has({ plan: "user:cmmc_lv1_full_access" })) redirect("/upgrade");

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="sticky top-0 z-30 border-b border-[#cfe3d9] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/assessments" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-9 w-auto"
            />
            <span className="font-serif text-2xl font-bold tracking-tight text-[#0f2f26]">
              Custodia<span className="text-[#2f8f6d]">.</span>
            </span>
            <span className="hidden border-l border-[#cfe3d9] pl-3 font-serif text-sm font-bold text-[#10231d] sm:inline">
              CMMC Level 1 workspace
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/opportunities"
              className="rounded-sm px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Opportunities
            </Link>
            <Link
              href="/profile/bid-ready"
              className="rounded-sm px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Bid profile
            </Link>
            <Link
              href="/"
              className="rounded-sm px-3 py-2 font-medium text-[#456c5f] transition-colors hover:bg-[#f1f6f3] hover:text-[#10231d]"
            >
              Home
            </Link>
            <div className="h-6 w-px bg-[#cfe3d9]" />
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </nav>
        </div>
      </header>
      <div className="flex">
        <div className="min-w-0 flex-1">{children}</div>
        <ComplianceOfficerRail />
      </div>
    </div>
  );
}
