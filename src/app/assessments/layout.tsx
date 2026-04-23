import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AssessmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/assessments" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-amber-400">
              C
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
                Custodia
              </div>
              <div className="text-sm font-bold text-slate-900">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Home
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <UserButton
              appearance={{ elements: { avatarBox: "h-8 w-8" } }}
            />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
