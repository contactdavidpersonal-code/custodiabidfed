"use client";

import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

/**
 * SSR-safe breakpoint hook.
 * - SSR / first paint: returns "desktop" (preserves existing layout, avoids hydration mismatch).
 * - Client: hydrates to the correct breakpoint via matchMedia and updates on resize.
 *
 * Breakpoints:
 *   mobile   <= 640px
 *   tablet   641 - 1024px
 *   desktop  >= 1025px
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const compute = (): Breakpoint => {
      if (typeof window === "undefined") return "desktop";
      const w = window.innerWidth;
      if (w <= 640) return "mobile";
      if (w <= 1024) return "tablet";
      return "desktop";
    };
    const update = () => setBp(compute());
    update();

    const mql1 = window.matchMedia("(max-width: 640px)");
    const mql2 = window.matchMedia("(max-width: 1024px)");
    mql1.addEventListener("change", update);
    mql2.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    return () => {
      mql1.removeEventListener("change", update);
      mql2.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return bp;
}

export function useIsMobile(): boolean {
  return useBreakpoint() === "mobile";
}

export function useIsTouch(): boolean {
  const bp = useBreakpoint();
  return bp !== "desktop";
}

/**
 * Returns true when the user prefers reduced motion.
 * SSR-safe (returns false on server).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Returns true when the on-screen keyboard is likely visible.
 * Uses visualViewport: when the visible viewport is meaningfully shorter
 * than the layout viewport (>150px), an IME or software keyboard is up.
 * SSR-safe (returns false on server / when visualViewport unavailable).
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const delta = window.innerHeight - vv.height;
      setOpen(delta > 150);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return open;
}
