"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Section-scoped "Ask Charlie to fill this in" CTA on the scope inventory
 * page. Fires the `charlie-send-message` window event the rail listens for
 * (see ComplianceOfficerRail.tsx) with a tailored prompt that tells Charlie
 * exactly what to interview the user about and which tool to call. Charlie
 * writes rows directly into scope_inventory / esp_registry / specialized_assets,
 * and the rail dispatches `custodia:scope-changed` on success — we listen
 * for that here and call router.refresh() so the new rows appear without a
 * full page reload.
 *
 * Mounted once at the page root (auto-listens for refreshes) and re-used per
 * section as a labeled prompt button.
 */
type Variant = "primary" | "secondary";

type ButtonProps = {
  prompt: string;
  label: string;
  helper?: string;
  variant?: Variant;
};

export function ScopeCharlieButton({
  prompt,
  label,
  helper,
  variant = "secondary",
}: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("charlie-send-message", {
            detail: { message: prompt },
          }),
        );
      }}
      className={
        isPrimary
          ? "group inline-flex items-center gap-2 border border-[#0e2a23] bg-[#0e2a23] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#10231d]"
          : "group inline-flex items-center gap-2 border border-[#bde0cc] bg-[#eaf3ee] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0e2a23] transition-colors hover:bg-[#dcecdf]"
      }
      title={helper}
    >
      <span
        aria-hidden
        className={
          isPrimary
            ? "inline-flex items-center justify-center bg-[#bdf2cf] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#0e2a23]"
            : "inline-flex items-center justify-center bg-[#0e2a23] px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#bdf2cf]"
        }
      >
        vCO
      </span>
      {label}
    </button>
  );
}

/**
 * Mount once on the scope page. Listens for `custodia:scope-changed` events
 * from the rail and refreshes the route so newly-inserted rows render.
 */
export function ScopeRefreshOnCharlie() {
  const router = useRouter();
  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener("custodia:scope-changed", handler);
    return () => window.removeEventListener("custodia:scope-changed", handler);
  }, [router]);
  return null;
}
