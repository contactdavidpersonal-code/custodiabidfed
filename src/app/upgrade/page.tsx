import { PricingTable } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UpgradePage() {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");
  if (has({ plan: "user:cmmc_lv1_full_access" })) redirect("/assessments");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-amber-400">
              C
            </span>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
                Custodia
              </div>
              <div className="text-sm font-bold text-slate-900">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12 text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
            One plan, everything included
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            Start your CMMC Level 1 membership
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Your annual membership covers the full attestation cycle, monthly
            AI compliance monitoring, and year-round Custodia Ticket Support
            from a compliance officer.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <PricingTable />
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          7-day free trial &mdash; cancel any time before it ends and you
          won&apos;t be charged. Questions?{" "}
          <a
            href="mailto:hello@custodia.gov"
            className="font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700"
          >
            Email us
          </a>
          .
        </p>
      </main>
    </div>
  );
}
