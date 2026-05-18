"use client";

/**
 * Post-checkout interstitial.
 *
 * Clerk's `__internal_openCheckout` redirects here after the trial /
 * subscription is created. The user's JWT still carries the *old* set
 * of plan claims at that moment (no `user:bidfedcmmc_self_service_`
 * yet), so if we sent them straight to `/onboard`, the server-side
 * `hasWorkspaceAccess(has)` check would return false and bounce them
 * right back to `/upgrade` — the "stuck on upgrade after starting the
 * trial" bug.
 *
 * We call `clerk.session.reload()` to force Clerk to refetch a fresh
 * session token (which includes the just-activated plan claim) before
 * navigating. We retry a couple of times in case the subscription
 * write is still propagating on Clerk's side.
 */

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MAX_ATTEMPTS = 8;
const ATTEMPT_DELAY_MS = 750;

export default function ActivatingPage() {
  const clerk = useClerk();
  const router = useRouter();
  const startedRef = useRef(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function go() {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
          await clerk.session?.reload();
        } catch {
          // ignore — try again
        }
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, ATTEMPT_DELAY_MS));
      }
      // Give the user an escape hatch in case something is genuinely wrong.
      if (!cancelled) setStalled(true);
      // Either way, push to /onboard — the server will gate it.
      router.replace("/onboard");
    }

    // Fire and forget; we navigate on completion.
    go();

    // Optimistically try sooner — after the very first reload, push.
    // (We don't wait for the full retry loop in the happy path.)
    const fast = setTimeout(async () => {
      if (cancelled) return;
      try {
        await clerk.session?.reload();
      } catch {
        // ignore
      }
      if (!cancelled) router.replace("/onboard");
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(fast);
    };
  }, [clerk, router]);

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
            href="/onboard"
            className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#bdf2cf] underline underline-offset-4"
          >
            Continue manually →
          </a>
        ) : null}
      </div>
    </div>
  );
}
