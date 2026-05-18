"use client";

/**
 * Client half of the activating interstitial.
 *
 * By the time we render, the server has already confirmed (via Clerk's
 * Billing Backend API) that the user's subscription exists. The browser
 * JWT still holds the pre-trial claim set, though, so a server-side
 * `redirect("/onboard")` would use a stale `has()` and bounce us back
 * to /upgrade.
 *
 * Solution: force `clerk.session.reload()` (which refetches a fresh
 * session token with the new plan claim) before navigating. Then push
 * the user into the workspace.
 */

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

export function ActivatingClient({ destination }: { destination: string }) {
  const clerk = useClerk();
  const startedRef = useRef(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const stallTimer = setTimeout(() => {
      if (!cancelled) setStalled(true);
    }, 6000);

    (async () => {
      try {
        // Refetch the session token so the new plan claim lands in the
        // JWT before the next server render reads it via `has({ plan })`.
        await clerk.session?.reload();
      } catch {
        // Ignore — we'll still try the navigation; /onboard has a backend
        // fallback that will accept the user even if the JWT is stale.
      }
      if (cancelled) return;
      // Hard nav rather than router.replace — this guarantees a fresh
      // server render that reads the just-refreshed session token.
      window.location.replace(destination);
    })();

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
    };
  }, [clerk, destination]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#052e22] px-6 text-[#f6f4ec]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#bdf2cf]/30 border-t-[#bdf2cf]"
        />
        <h1 className="font-serif text-2xl font-bold text-white">
          Activating your trial…
        </h1>
        <p className="max-w-sm text-sm text-[#a8cfc0]">
          One second while we finish setting up your Custodia workspace.
        </p>
        {stalled ? (
          <a
            href={destination}
            className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#bdf2cf] underline underline-offset-4"
          >
            Continue manually →
          </a>
        ) : null}
      </div>
    </div>
  );
}
