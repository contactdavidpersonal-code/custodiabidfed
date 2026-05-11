"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * Curated list of NAICS codes whose primes most commonly need a small,
 * CMMC Level 1-fit subcontractor. Pulled from the SAM.gov FY2024 award
 * distribution and the DoD CMMC RIA, then filtered to codes where the
 * average award size and contract type land within Level 1 territory
 * (i.e., FCI-only, no CUI).
 */
const NAICS_PRESETS: { code: string; label: string; group: string }[] = [
  // Construction & facilities
  { code: "236220", label: "Commercial / institutional building construction", group: "Construction & Facilities" },
  { code: "238210", label: "Electrical contractors", group: "Construction & Facilities" },
  { code: "238220", label: "Plumbing, heating, A/C contractors", group: "Construction & Facilities" },
  { code: "238910", label: "Site preparation contractors", group: "Construction & Facilities" },
  { code: "237310", label: "Highway, street, bridge construction", group: "Construction & Facilities" },
  { code: "561210", label: "Facilities support services", group: "Construction & Facilities" },
  { code: "561720", label: "Janitorial services", group: "Construction & Facilities" },
  { code: "561730", label: "Landscaping services", group: "Construction & Facilities" },
  // IT & professional services (L1 lane: managed services, not classified work)
  { code: "541511", label: "Custom computer programming services", group: "IT & Professional Services" },
  { code: "541512", label: "Computer systems design services", group: "IT & Professional Services" },
  { code: "541513", label: "Computer facilities management services", group: "IT & Professional Services" },
  { code: "541519", label: "Other computer-related services", group: "IT & Professional Services" },
  { code: "541611", label: "Administrative management consulting", group: "IT & Professional Services" },
  { code: "541618", label: "Other management consulting services", group: "IT & Professional Services" },
  { code: "541330", label: "Engineering services", group: "IT & Professional Services" },
  // Manufacturing (commercial-side L1 lane)
  { code: "332710", label: "Machine shops", group: "Manufacturing" },
  { code: "332999", label: "Other miscellaneous fabricated metal", group: "Manufacturing" },
  { code: "333318", label: "Other commercial & service industry machinery", group: "Manufacturing" },
  { code: "334290", label: "Other communications equipment manufacturing", group: "Manufacturing" },
  { code: "335931", label: "Current-carrying wiring device manufacturing", group: "Manufacturing" },
  // Logistics & supply
  { code: "493110", label: "General warehousing & storage", group: "Logistics & Supply" },
  { code: "484121", label: "General freight trucking, long-distance", group: "Logistics & Supply" },
  { code: "423610", label: "Electrical apparatus wholesale", group: "Logistics & Supply" },
  { code: "423840", label: "Industrial supplies wholesale", group: "Logistics & Supply" },
  // Training & support
  { code: "611430", label: "Professional & management training", group: "Training & Support" },
  { code: "541219", label: "Other accounting services", group: "Training & Support" },
  { code: "541990", label: "All other professional & technical services", group: "Training & Support" },
  // Security & safety
  { code: "561621", label: "Security systems services", group: "Security & Safety" },
  { code: "561612", label: "Security guards & patrol services", group: "Security & Safety" },
  { code: "541690", label: "Other scientific & technical consulting", group: "Security & Safety" },
];

const GROUP_ORDER = [
  "Construction & Facilities",
  "IT & Professional Services",
  "Manufacturing",
  "Logistics & Supply",
  "Training & Support",
  "Security & Safety",
];

type Status = "idle" | "submitting" | "success" | "error";

export default function BidDigestPage() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      group: g,
      items: NAICS_PRESETS.filter((n) => n.group === g),
    }));
  }, []);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/bid-digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          naicsCodes: Array.from(selected),
          source: "bid-digest-landing",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not save subscription.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#10231d]">
      {/* Hero */}
      <header className="relative overflow-hidden bg-[#08201a] px-6 py-16 text-white md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -10%, rgba(141,210,177,0.16), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-6 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#7aab98]">
            Monday Bid Digest &middot; Free
          </div>
          <h1 className="font-serif text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl">
            New SAM.gov opportunities you can actually win &mdash; every Monday at 7am ET.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[#a8cfc0] md:text-lg">
            A short, hand-filtered digest of brand-new federal solicitations
            that match your NAICS codes and fit a small CMMC Level 1
            contractor. No CUI-heavy programs. No primes-only IDIQs. No
            spam. Free, forever.
          </p>
        </div>
      </header>

      {/* Form */}
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        {status === "success" ? (
          <div className="border-2 border-[#2f8f6d] bg-[#f7fcf9] p-8 text-center">
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
              Almost done
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold text-[#10231d]">
              Check your inbox.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#1d3a30]">
              We just sent a confirmation link to{" "}
              <strong>{email}</strong>. Click it and you&apos;re on the
              list. (Check spam if it&apos;s not there in 60 seconds.)
            </p>
            <div className="mt-6">
              <Link
                href="/cmmc-check"
                className="inline-flex items-center bg-[#08201a] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0e2a23]"
              >
                While you wait &mdash; take the free CMMC check &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-8">
            <section>
              <label
                htmlFor="email"
                className="block font-serif text-lg font-bold text-[#10231d]"
              >
                Your work email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="mt-2 w-full border border-[#cfe3d9] bg-white px-4 py-3 text-base text-[#10231d] outline-none focus:border-[#2f8f6d]"
                maxLength={320}
                autoComplete="email"
              />
              <p className="mt-2 text-sm text-[#5a7d70]">
                We&apos;ll send a confirmation link &mdash; one click and
                you&apos;re in. Unsubscribe in any email, instantly.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-lg font-bold text-[#10231d]">
                Pick the NAICS codes you bid on
              </h2>
              <p className="mt-1 text-sm text-[#5a7d70]">
                Optional. Pick as many as you want. If you skip this,
                you&apos;ll get every Monday&apos;s top picks across all
                Level 1 lanes.
              </p>
              <div className="mt-4 space-y-6">
                {grouped.map((g) => (
                  <div key={g.group}>
                    <div className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                      {g.group}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((n) => {
                        const checked = selected.has(n.code);
                        return (
                          <label
                            key={n.code}
                            className={
                              "flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition-colors " +
                              (checked
                                ? "border-[#2f8f6d] bg-[#f7fcf9]"
                                : "border-[#cfe3d9] hover:border-[#7aab98]")
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(n.code)}
                              className="mt-1 h-4 w-4 accent-[#2f8f6d]"
                            />
                            <span>
                              <span className="block font-mono text-[11px] font-bold text-[#1f5c47]">
                                {n.code}
                              </span>
                              <span className="block text-sm leading-snug text-[#1d3a30]">
                                {n.label}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {errorMsg ? (
              <div className="border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {errorMsg}
              </div>
            ) : null}

            <div>
              <button
                type="submit"
                disabled={status === "submitting" || !email}
                className="inline-flex items-center bg-[#08201a] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0e2a23] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "submitting"
                  ? "Sending confirmation…"
                  : selected.size > 0
                    ? `Subscribe (${selected.size} NAICS selected) →`
                    : "Subscribe →"}
              </button>
              <p className="mt-3 text-xs text-[#5a7d70]">
                We don&apos;t sell, rent, or share your email. The digest is
                a Custodia loss leader &mdash; we send great content; some
                Mondays we&apos;ll mention the platform. That&apos;s it.
              </p>
            </div>
          </form>
        )}

        {/* What's inside */}
        <section className="mt-16 border-t border-[#cfe3d9] pt-12">
          <h2 className="font-serif text-2xl font-bold text-[#10231d]">
            What&apos;s in a Monday Bid Digest
          </h2>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#1d3a30]">
            <li>
              <strong>5&ndash;10 brand-new SAM.gov solicitations</strong>{" "}
              that match your NAICS codes, posted in the last 7 days.
            </li>
            <li>
              <strong>Pre-filtered for Level 1 fit.</strong> No DFARS
              7012/CUI-required work. No primes-only IDIQs. No vehicles
              where small businesses can&apos;t register.
            </li>
            <li>
              <strong>The CMMC line, called out.</strong> Each
              opportunity is labeled L1, L2, or &ldquo;TBD&rdquo; so you
              know up front whether you can bid.
            </li>
            <li>
              <strong>One short policy or regulation note</strong> &mdash;
              the kind of thing you&apos;d miss if you weren&apos;t
              already on this list.
            </li>
            <li>
              <strong>Two minutes to read.</strong> No fluff. No newsletter
              padding.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
