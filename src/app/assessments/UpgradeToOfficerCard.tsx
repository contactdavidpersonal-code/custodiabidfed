import Link from "next/link";

/**
 * Inline upsell card for users without the `custodia_officer` feature.
 * Shown anywhere a Self-Service ($149) account tries to talk to a real
 * human Custodia Compliance Officer. The path forward is the $297
 * Self-Service + Custodia Officer plan, or — for needs beyond CMMC L1 —
 * dedicated security consulting.
 */
export function UpgradeToOfficerCard({
  reason,
  compact = false,
}: {
  /** Optional one-line context above the card. */
  reason?: string;
  /** Tighter card for inline placement (rail, banner, etc.). */
  compact?: boolean;
}) {
  return (
    <section
      className={`border border-[#cfe3d9] bg-white ${
        compact ? "p-4" : "p-6"
      } shadow-[0_2px_0_rgba(14,48,37,0.04)]`}
    >
      {reason ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#a06b1a]">
          {reason}
        </p>
      ) : null}
      <h3
        className={`font-serif font-bold text-[#10231d] ${
          compact ? "text-lg" : "text-xl"
        }`}
      >
        Talk to a credentialed human Compliance Officer
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[#4a7164]">
        Charlie handles 95% of CMMC Level 1 on the Self Service plan. The
        remaining 5% — odd boundaries, prime asks, audit chatter, security
        questions that go past L1 — is where a real Custodia officer earns
        their keep. Add <strong>Custodia Officer</strong> to unlock unlimited
        tickets, officer-led audit support, and pre-submission review.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/upgrade?plan=bidfedcmmc_self_service_custodia_officer_"
          className="group flex flex-col gap-1 border border-[#1d6a4a] bg-[#0e2a23] p-4 text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8dd2b1]">
            Add Custodia Officer
          </span>
          <span className="font-serif text-2xl font-bold text-white">
            $297<span className="text-sm font-normal text-[#8dd2b1]">/mo</span>
          </span>
          <span className="text-xs text-[#bdf2cf]">
            Unlimited officer tickets · audit support · pre-submission review
          </span>
          <span className="mt-2 text-xs font-semibold text-white">
            Upgrade my plan &rarr;
          </span>
        </Link>

        <a
          href="mailto:officers@custodia.us?subject=Security%20consulting%20beyond%20CMMC%20L1"
          className="flex flex-col gap-1 border border-[#cfe3d9] bg-[#f7fcf9] p-4 text-[#10231d] transition-colors hover:border-[#2f8f6d]"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a06b1a]">
            Beyond CMMC L1
          </span>
          <span className="font-serif text-base font-bold">
            Security consulting
          </span>
          <span className="text-xs text-[#4a7164]">
            CMMC L2 / DFARS 7012, FedRAMP prep, prime audits, incident
            response, custom security work. Scoped engagements, credentialed
            humans, fixed fee.
          </span>
          <span className="mt-2 text-xs font-semibold text-[#1d6a4a]">
            Book a scoping call &rarr;
          </span>
        </a>
      </div>
    </section>
  );
}
