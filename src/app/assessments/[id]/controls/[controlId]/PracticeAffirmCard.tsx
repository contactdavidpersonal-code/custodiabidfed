// Per-practice Sign & Affirm card.
//
// Rendered server-side as a sibling of <PracticeChat> on the practice
// detail page. Three visual states:
//   1. Locked, current snapshot signed — small "Affirmed" badge.
//   2. Locked, snapshot drifted from signature — stale banner urging
//      re-affirm before shipping the SPRS packet.
//   3. Unlocked or never signed — full attest copy + typed signature form.
//
// The form posts to `affirmPracticeAction` (a server action), which
// tenant-checks, rebuilds the snapshot from authoritative DB state, and
// inserts a new `practice_affirmations` row.

import type { AffirmationRow } from "@/lib/cmmc/affirmation";

type Props = {
  assessmentId: string;
  controlId: string;
  /** Practice itself locked-as-MET. We let users affirm before or after lock,
   *  but the copy changes ("you're attesting this practice meets..."). */
  locked: boolean;
  latest: AffirmationRow | null;
  stale: boolean;
  affirmAction: (formData: FormData) => Promise<void> | void;
};

export function PracticeAffirmCard({
  assessmentId,
  controlId,
  locked,
  latest,
  stale,
  affirmAction,
}: Props) {
  const signedDate = latest
    ? new Date(latest.signed_at).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <section className="mx-auto mt-10 max-w-4xl px-4 pb-16 md:px-6">
      <div className="border border-[#cfe3d9] bg-white">
        <header className="border-b border-[#cfe3d9] bg-[#f4faf6] px-6 py-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
            Sign &amp; Affirm — {controlId}
          </div>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#10231d]">
            Lock this practice into the SPRS packet
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#5a7d70]">
            Your signature hashes the current intake, objective verdicts, and
            evidence list. The SPRS bid packet won&apos;t render until the
            latest signature&apos;s hash matches today&apos;s snapshot — so
            re-affirm whenever evidence changes.
          </p>
        </header>

        <div className="px-6 py-5">
          {latest && !stale && (
            <div className="border-l-4 border-[#08201a] bg-[#f4faf6] px-5 py-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#2f8f6d]">
                Affirmed and current
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
                <strong className="font-semibold">{latest.signed_name}</strong>{" "}
                signed this practice on {signedDate}. The signed snapshot
                matches the live evidence — this practice is ready to ship.
              </p>
              <p className="mt-3 font-mono text-[10px] text-[#5a7d70]">
                Hash: {latest.content_hash.slice(0, 16)}…
              </p>
            </div>
          )}

          {latest && stale && (
            <div className="border-l-4 border-amber-600 bg-amber-50 px-5 py-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-800">
                Signature out of date — re-affirm to ship
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
                <strong className="font-semibold">{latest.signed_name}</strong>{" "}
                signed this practice on {signedDate}, but evidence or answers
                have changed since then. The SPRS packet will refuse to render
                until you sign the current snapshot below.
              </p>
            </div>
          )}

          {!latest && (
            <div className="border-l-4 border-[#cfe3d9] bg-[#f4faf6] px-5 py-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
                Not yet affirmed
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#10231d]">
                When you&apos;re satisfied that the evidence above accurately
                reflects how your organization meets {controlId}, sign below.
                Your signature is hashed alongside the snapshot so we can
                prove nothing changed between signing and filing.
              </p>
            </div>
          )}

          <form action={affirmAction} className="mt-6 space-y-4">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="controlId" value={controlId} />

            <div className="border border-[#cfe3d9] bg-[#fbfdfb] p-5 text-[13px] leading-relaxed text-[#10231d]">
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
                Attestation
              </div>
              <p>
                I, the signer named below, affirm that the information
                captured for {controlId} is accurate and complete to the best
                of my knowledge. I understand that this attestation is the
                basis for the organization&apos;s SPRS score and that
                knowingly false statements may result in civil or criminal
                penalties under 18 U.S.C. § 1001 and the False Claims Act
                (31 U.S.C. §§ 3729–3733).
                {locked ? (
                  <>
                    {" "}
                    I further attest that this practice is{" "}
                    <strong className="font-semibold">implemented</strong> and
                    meets the requirements of {controlId}.
                  </>
                ) : null}
              </p>
            </div>

            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#5a7d70]">
                Your full legal name
              </span>
              <input
                type="text"
                name="signedName"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                placeholder="Jane A. Doe"
                className="mt-1 block w-full border border-[#cfe3d9] bg-white px-3 py-2 font-serif text-[18px] italic text-[#10231d] outline-none focus:border-[#2f8f6d]"
              />
            </label>

            <label className="flex items-start gap-3 text-[13px] leading-relaxed text-[#10231d]">
              <input
                type="checkbox"
                name="acknowledged"
                required
                className="mt-1 h-4 w-4 border border-[#cfe3d9] accent-[#2f8f6d]"
              />
              <span>
                I have read the attestation above and intend my typed name to
                serve as my legal signature for this practice.
              </span>
            </label>

            <button
              type="submit"
              className="border border-[#08201a] bg-[#08201a] px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#10231d]"
            >
              {latest ? "Re-affirm with current snapshot" : "Sign & affirm"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
