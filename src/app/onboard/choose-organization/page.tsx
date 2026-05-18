import { OrganizationList } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Themed in-app replacement for Clerk's hosted "choose-organization" task
 * page (accounts.bidfedcmmc.com/sign-in/tasks/choose-organization). Renders
 * the same flow — list existing orgs + create-new button — but inside the
 * Custodia brand shell. <OrganizationList /> inherits brand colors from
 * <ClerkProvider appearance={clerkAppearance}> in src/app/layout.tsx.
 *
 * Point Clerk's `choose-organization` task URL at this route in the dashboard
 * (Configure → Sessions → Tasks) to activate.
 */
export default async function ChooseOrganizationPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-[#0e2a23] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-md">
          <Link
            href="/"
            className="font-serif text-xl font-bold tracking-tight text-white hover:text-[#bdf2cf]"
          >
            Custodia<span className="text-[#8dd2b1]">.</span>
          </Link>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
            Pick a workspace
          </p>
          <h1 className="mt-2 font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            Choose your{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              compliance workspace
            </span>
            .
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#a8cfc0]">
            Each workspace keeps a separate FAR 52.204-21 evidence pack, SSP,
            and SPRS history. Pick the one you want to work in, or spin up a
            new one for another business you own.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <OrganizationList
            hidePersonal
            skipInvitationScreen
            afterSelectOrganizationUrl="/onboard"
            afterCreateOrganizationUrl="/onboard"
          />
        </div>
      </div>
    </main>
  );
}
