import { PricingTable } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UpgradePage() {
  const { userId, has } = await auth();
  if (!userId) redirect("/sign-in");

  // If the user already has active access (paid OR active trial), Clerk's `has`
  // returns true. We send them straight back into the workspace — no payment
  // collection until the trial ends and the plan flips to inactive.
  if (has({ plan: "user:cmmc_lv1_full_access" })) redirect("/assessments");

  // Falls through here when:
  //   - the 14-day trial has expired (Clerk revokes the plan), OR
  //   - the user never started the trial / it lapsed without payment.
  // This is the only state where we actually show the PricingTable to take a card.
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/custodia-logo.png"
              alt="Custodia shield"
              className="h-9 w-auto"
            />
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                Custodia
              </div>
              <div className="font-serif text-sm font-bold text-[#10231d]">
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
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
            Trial ended &middot; Summer Federal Cash Incentive
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#10231d] md:text-5xl">
            Keep your bid-eligibility.
            <br className="hidden md:block" /> Activate your membership.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#4a7164]">
            Your 14-day free trial has ended. Add a payment method below to keep your
            CMMC Level&nbsp;1 package active, your evidence freshness alerts on, and your
            virtual compliance officer on call year-round.{" "}
            <span className="font-semibold text-[#10231d]">$449/mo</span>{" "}
            <span className="text-[#5a7f72] line-through">$749</span> &mdash; locked-in
            launch pricing for the next 100 customers.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#5a7f72]">
            14-day money-back guarantee from your first payment. Cancel any time inside
            the platform.
          </p>
        </div>

        <div className=" border border-[#cfe3d9] bg-white p-8 shadow-[0_2px_0_rgba(14,48,37,0.04),0_18px_44px_rgba(14,48,37,0.08)]">
          <PricingTable />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "vCO year-round",
              body: "Open a ticket any time and a Custodia compliance officer responds with audit-grade guidance. Included with every active membership.",
            },
            {
              title: "Connector monitoring",
              body: "Connect Microsoft 365 or Google Workspace and Custodia continuously monitors your evidence, MFA enforcement, and access controls.",
            },
            {
              title: "Annual re-affirmation",
              body: "We prep your SPRS re-submission every October at no extra charge so your bid-eligibility never quietly drifts.",
            },
          ].map((b) => (
            <div
              key={b.title}
              className=" border border-[#cfe3d9] bg-white p-5"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                {b.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#4a7164]">{b.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-[#5a7f72]">
          Questions before you reactivate?{" "}
          <a
            href="mailto:support@custodia.dev"
            className="font-medium text-[#20684f] underline underline-offset-2 hover:text-[#174f3c]"
          >
            support@custodia.dev
          </a>
          .
        </p>
      </main>
    </div>
  );
}
