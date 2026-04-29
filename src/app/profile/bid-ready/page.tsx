import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureOrgForUser } from "@/lib/assessment";
import { loadBidProfile } from "@/lib/bid-profile";
import { getRadarEmailsEnabled } from "@/lib/sam-radar";
import {
  draftCapabilityAction,
  draftDifferentiatorsAction,
  saveBidProfileAction,
  toggleRadarEmailsAction,
} from "./actions";
import { BidProfileForm } from "./BidProfileForm";

export const dynamic = "force-dynamic";

export default async function BidReadyProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await ensureOrgForUser(userId);
  const profile = await loadBidProfile(org.id);
  const radarEmailsEnabled = await getRadarEmailsEnabled(org.id);

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
              Master profile
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold">
              Bid-Ready Profile
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
              The editable foundation behind every Bid-Ready Packet you
              generate. Edit anytime — generated packets are immutable
              snapshots of this profile at a moment in time.
            </p>
          </div>
          <Link
            href="/assessments"
            className="rounded-sm border border-[#cfe3d9] bg-white px-3 py-2 text-sm font-medium text-[#10231d] hover:bg-[#f1f6f3]"
          >
            ← Workspace
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 rounded-md border border-[#cfe3d9] bg-white p-5">
          <h2 className="font-serif text-lg font-bold">
            Locked identifiers
          </h2>
          <p className="mt-1 text-xs text-[#456c5f]">
            These come from your registration and your CMMC self-assessment.
            They&apos;re the trust signals on every packet, so they aren&apos;t
            editable here. To change them, fix the source of truth.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <Locked label="Legal name" value={org.name} />
            <Locked label="Entity type" value={org.entity_type ?? "—"} />
            <Locked label="SAM UEI" value={org.sam_uei ?? "Not on file"} />
            <Locked label="CAGE code" value={org.cage_code ?? "Not on file"} />
            <Locked
              label="NAICS"
              value={
                org.naics_codes.length ? org.naics_codes.join(", ") : "—"
              }
            />
            <Locked
              label="Scope statement"
              value={org.scoped_systems ? "On file" : "Not on file"}
            />
          </dl>
          <p className="mt-4 text-xs text-[#456c5f]">
            Edit these in{" "}
            <Link
              href="/assessments"
              className="font-semibold text-[#2f8f6d] underline"
            >
              your workspace
            </Link>
            .
          </p>
        </div>

        <BidProfileForm
          initial={profile}
          saveAction={saveBidProfileAction}
          draftCapabilityAction={draftCapabilityAction}
          draftDifferentiatorsAction={draftDifferentiatorsAction}
        />

        <div className="mt-6 rounded-md border border-[#cfe3d9] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg font-bold">
                SAM.gov opportunity emails
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#456c5f]">
                Every Monday morning we email you new SAM.gov contract
                opportunities matched to your NAICS codes
                {org.naics_codes.length > 0
                  ? ` (${org.naics_codes.join(", ")})`
                  : " (set NAICS in your workspace to start matching)"}
                . The matched opportunities also live in your{" "}
                <Link
                  href="/opportunities"
                  className="font-semibold text-[#2f8f6d] underline"
                >
                  in-app inbox
                </Link>{" "}
                whether or not you receive the email.
              </p>
              <p className="mt-2 text-xs text-[#456c5f]">
                <b>Status:</b>{" "}
                {radarEmailsEnabled ? (
                  <span className="font-semibold text-[#2f8f6d]">
                    Subscribed — you&apos;ll receive the next Monday digest.
                  </span>
                ) : (
                  <span className="font-semibold text-[#a06b1a]">
                    Unsubscribed — opportunities still live in your in-app inbox.
                  </span>
                )}
              </p>
            </div>
            <form action={toggleRadarEmailsAction}>
              <input
                type="hidden"
                name="enabled"
                value={radarEmailsEnabled ? "false" : "true"}
              />
              <button
                type="submit"
                className={
                  radarEmailsEnabled
                    ? "rounded-sm border border-[#a06b1a] bg-white px-3 py-2 text-sm font-semibold text-[#a06b1a] hover:bg-[#fff5e8]"
                    : "rounded-sm border border-[#2f8f6d] bg-[#2f8f6d] px-3 py-2 text-sm font-semibold text-white hover:bg-[#287a5d]"
                }
              >
                {radarEmailsEnabled ? "Unsubscribe" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function Locked({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#456c5f]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm text-[#10231d]">{value}</dd>
    </div>
  );
}
