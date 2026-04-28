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
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#0e2a23] text-sm font-black text-[#bdf2cf]">
              C
            </span>
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia
              </div>
              <div className="font-serif text-sm font-bold text-[#10231d]">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
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
        <ComplianceOfficerRail />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
