import { PricingTable } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UpgradePage() {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");
  if (has({ plan: "user:cmmc_lv1_full_access" })) redirect("/assessments");

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#d5e5dd] bg-[#f7f7f3]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#12382c] text-sm font-black text-[#9be0bf]">
              C
            </span>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia
              </div>
              <div className="text-sm font-bold text-[#10231d]">
                CMMC Level 1 workspace
              </div>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-[#456c5f] transition-colors hover:text-[#10231d]"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12 text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
            CMMC Level 1 Membership
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
            Clear, guided compliance for $249/mo.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#4a7164]">
            Your AI compliance officer guides all 17 FAR 52.204-21 practices, and a Custodia compliance officer is in the loop for support and pushback scenarios. 7-day free trial, no credit card required.
          </p>
        </div>

        <div className="rounded-3xl border border-[#cfe3d9] bg-white p-8 shadow-[0_10px_28px_rgba(14,48,37,0.07)]">
          <PricingTable />
        </div>

        <p className="mt-8 text-center text-sm text-[#5a7f72]">
          7-day free trial &mdash; cancel any time before it ends and you
          won&apos;t be charged. Questions?{" "}
          <a
            href="mailto:hello@custodia.gov"
            className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
          >
            Email us
          </a>
          .
        </p>
      </main>
    </div>
  );
}
