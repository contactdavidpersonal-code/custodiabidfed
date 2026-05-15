"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "custodia.course-sidebar.open";

export type SectionStatus = "locked" | "available" | "in_progress" | "complete";

export type CourseSection = {
  id: string;
  href: string;
  step: number;
  title: string;
  subtitle: string;
  status: SectionStatus;
  match: "exact" | "prefix";
};

type Props = {
  sections: CourseSection[];
  assessmentId: string;
  /** Locked links navigate here so the user always lands on the next step
   * they actually owe work on, instead of bouncing through a server redirect. */
  currentStepHref: string;
};

/**
 * Course sidebar with a single sliding "liquid" indicator that morphs between
 * the active item's bounding box. The indicator uses a soft radial gradient
 * + an SVG goo filter for the organic feel; the slide is a long
 * cubic-bezier with a hint of spring overshoot.
 *
 * Sidebar state (open/collapsed) is persisted in localStorage so the user's
 * preference survives navigation.
 */
export function CourseSidebar({ sections, currentStepHref }: Props) {
  const pathname = usePathname();
  // Collapsed by default so the main content gets the full canvas. The user can
  // expand the rail and that preference is persisted in localStorage.
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 0,
    visible: false,
  });

  useEffect(() => {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "1") setOpen(true);
    setHydrated(true);
  }, []);

  const activeId = (() => {
    let bestId: string | null = null;
    let bestLen = -1;
    for (const s of sections) {
      const matches = s.match === "exact" ? pathname === s.href : pathname.startsWith(s.href);
      if (matches && s.href.length > bestLen) {
        bestId = s.id;
        bestLen = s.href.length;
      }
    }
    return bestId;
  })();

  useLayoutEffect(() => {
    if (!activeId) {
      setIndicator((i) => ({ ...i, visible: false }));
      return;
    }
    const el = itemRefs.current[activeId];
    if (!el) return;
    const parent = el.offsetParent as HTMLElement | null;
    const top = el.offsetTop;
    const height = el.offsetHeight;
    setIndicator({ top, height, visible: true });
    void parent;
  }, [activeId, open, hydrated, pathname]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      window.localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  return (
    <aside
      className="hidden lg:block sticky top-[72px] z-10 h-[calc(100vh-72px)] shrink-0 border-r border-[#063f2e]/10 bg-gradient-to-b from-[#fbfcf9] to-[#f3f7f1] transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden"
      style={{ width: open ? 288 : 56 }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[#063f2e]/10 px-4 py-4">
          {open && (
            <div className="leading-tight">
              <div className="inline-flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.22em] text-[#063f2e]/55">
                <span className="h-1 w-1 rounded-full bg-[#063f2e]" />
                FCI readiness
              </div>
              <div className="mt-1.5 font-serif text-base font-normal tracking-[-0.02em] text-[#063f2e]">
                Your bid-ready journey
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            className="rounded-full p-1.5 text-[#063f2e]/55 transition-colors hover:bg-[#063f2e]/8 hover:text-[#063f2e]"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              {open ? (
                <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
              ) : (
                <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
              )}
            </svg>
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-2 py-3">
          {/* SVG goo filter: blurs + thresholds alpha so adjacent green shapes
              (vertical rail, leading droplet, active pill) merge into a single
              continuous liquid blob as the indicator moves between steps. */}
          <svg
            aria-hidden
            width="0"
            height="0"
            className="pointer-events-none absolute"
          >
            <defs>
              <filter id="course-liquid-goo">
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="4"
                  result="blur"
                />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
                  result="goo"
                />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
          </svg>

          {/* Liquid indicator group — wrapped so the goo filter merges shapes. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{ filter: "url(#course-liquid-goo)" }}
          >
            {(() => {
              // Geometry: nav has px-2 (8px). When collapsed the dot is centred
              // in the 56px rail (28px dot, sidebar inner 40px, link px-3 12+14
              // = dot centre 26px from link left + 8px nav pad = 34px from rail).
              const dotCenterX = open ? 24 : 26; // x within indicator container
              const activeCenterY = indicator.visible
                ? indicator.top + indicator.height / 2
                : 0;
              const pillTop = open
                ? indicator.top + 3
                : activeCenterY - 18;
              const pillHeight = open ? indicator.height - 6 : 36;
              const pillLeft = open ? 4 : dotCenterX - 18;
              const pillRight = open ? 6 : undefined;
              const pillWidth = open ? undefined : 36;
              const visible = indicator.visible && hydrated;
              return (
                <>
                  {/* Vertical rail — a column of liquid running from the top of the
                      nav down to the active step's centre. Height animates as the
                      user navigates so it reads as flow. */}
                  <div
                    className="absolute rounded-full bg-gradient-to-b from-[#2f8f6d] via-[#5fb98a] to-[#bef4be] transition-[height,opacity] duration-[700ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
                    style={{
                      top: 8,
                      left: dotCenterX - 1.5,
                      width: 3,
                      height: visible ? Math.max(0, activeCenterY - 8) : 0,
                      opacity: visible ? 0.85 : 0,
                    }}
                  />

                  {/* Leading droplet — sits at the head of the rail and slides to
                      the active step. Goo filter fuses it into the pill below. */}
                  <div
                    className="absolute rounded-full bg-[#2f8f6d] transition-[top,opacity] duration-[700ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
                    style={{
                      top: activeCenterY - 6,
                      left: dotCenterX - 6,
                      width: 12,
                      height: 12,
                      opacity: visible ? 1 : 0,
                    }}
                  />

                  {/* Active step pill / halo. Circle when collapsed (wraps the
                      step dot tightly), full-width pill when expanded. */}
                  <div
                    className="absolute bg-gradient-to-br from-[#bef4be] via-[#a8e8b0] to-[#7ed8a0] shadow-[0_4px_14px_-6px_rgba(47,143,109,0.45)] transition-[top,height,left,right,width,border-radius,opacity] duration-[700ms] ease-[cubic-bezier(0.34,1.2,0.64,1)]"
                    style={{
                      top: pillTop,
                      height: pillHeight,
                      left: pillLeft,
                      right: pillRight,
                      width: pillWidth,
                      borderRadius: open ? 16 : 999,
                      opacity: visible ? 1 : 0,
                    }}
                  />
                </>
              );
            })()}
          </div>

          <ul className="relative z-10 space-y-1">
            {sections.map((s) => {
              const isActive = s.id === activeId;
              const locked = s.status === "locked";
              const complete = s.status === "complete";
              return (
                <li key={s.id}>
                  <Link
                    ref={(el) => {
                      itemRefs.current[s.id] = el;
                    }}
                    href={locked ? currentStepHref : s.href}
                    aria-disabled={locked || undefined}
                    title={locked ? `Finish your current step first \u2014 ${s.subtitle}` : undefined}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      isActive
                        ? "text-[#063f2e]"
                        : complete
                          ? "text-[#063f2e] hover:bg-[#063f2e]/5"
                          : locked
                            ? "text-[#063f2e]/40 hover:bg-[#063f2e]/5 hover:text-[#063f2e]/65"
                            : "text-[#063f2e]/65 hover:bg-[#063f2e]/5 hover:text-[#063f2e]"
                    }`}
                  >
                    <StepDot step={s.step} status={s.status} active={isActive} />
                    {open && (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`truncate text-sm font-medium tracking-tight ${
                              isActive
                                ? "text-[#063f2e]"
                                : complete
                                  ? "text-[#063f2e]"
                                  : ""
                            }`}
                          >
                            {s.title}
                          </span>
                          {locked && (
                            <svg
                              viewBox="0 0 20 20"
                              className="h-3 w-3 flex-none text-[#063f2e]/35"
                              fill="currentColor"
                              aria-hidden
                            >
                              <path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
                            </svg>
                          )}
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[11px] ${
                            isActive
                              ? "text-[#063f2e]/75"
                              : complete
                                ? "text-[#2f8f6d]"
                                : "text-[#063f2e]/50"
                          }`}
                        >
                          {s.subtitle}
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {open && (
          <div className="border-t border-[#063f2e]/10 px-4 py-3 text-[11px] leading-relaxed text-[#063f2e]/50">
            Every step is open during your 14-day free trial. Steps with a lock icon need a prior step finished before they fully unlock &mdash; click any step to see what&apos;s missing.
          </div>
        )}
      </div>
    </aside>
  );
}

function StepDot({
  step,
  status,
  active,
}: {
  step: number;
  status: SectionStatus;
  active: boolean;
}) {
  if (status === "complete") {
    return (
      <span className="relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#063f2e] text-[#bef4be]">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-medium tabular-nums ${
        active
          ? "bg-[#063f2e] text-[#bef4be]"
          : status === "locked"
            ? "border border-dashed border-[#063f2e]/20 bg-white text-[#063f2e]/40"
            : "border border-[#063f2e]/15 bg-white text-[#063f2e]"
      }`}
    >
      {step}
    </span>
  );
}
