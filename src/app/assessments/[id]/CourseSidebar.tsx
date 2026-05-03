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
export function CourseSidebar({ sections }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 0,
    visible: false,
  });

  useEffect(() => {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "0") setOpen(false);
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
      className="hidden lg:block sticky top-[57px] z-10 h-[calc(100vh-57px)] shrink-0 border-r border-[#cfe3d9] bg-[#fbfcf9] transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden"
      style={{ width: open ? 288 : 56 }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[#cfe3d9] px-3 py-3">
          {open && (
            <div className="leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f8f6d]">
                FCI readiness
              </div>
              <div className="font-serif text-sm font-bold text-[#10231d]">
                Your bid-ready journey
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            className=" p-1.5 text-[#7a9c90] transition-colors hover:bg-[#eaf3ee] hover:text-[#10231d]"
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
          {/* Sliding active indicator. A sharp mint slab with a deep-green
          left rule — finance-firm aesthetic, no blur, no blobs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2 z-0"
      >
        <div
          className="absolute left-0 right-0 transition-[top,height,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            top: indicator.top,
            height: indicator.height,
            opacity: indicator.visible && hydrated ? 1 : 0,
          }}
        >
          <div className="absolute inset-y-1 left-0 right-1  bg-[#bdf2cf]" />
          <div className="absolute inset-y-1 left-0 w-[3px] bg-[#0e2a23]" />
        </div>
      </div>

          <ul className="relative z-10 space-y-1">
            {sections.map((s) => {
              const isActive = s.id === activeId;
              const locked = s.status === "locked";
              return (
                <li key={s.id}>
                  <Link
                    ref={(el) => {
                      itemRefs.current[s.id] = el;
                    }}
                    href={s.href}
                    aria-disabled={locked || undefined}
                    title={locked ? `Available now \u2014 ${s.subtitle}` : undefined}
                    className={`relative flex items-center gap-3  px-3 py-2.5 transition-colors ${
                      isActive
                        ? "text-[#0c2219]"
                        : locked
                          ? "text-[#7a9c90] hover:bg-[#eef5f0] hover:text-[#10231d]"
                          : "text-[#456c5f] hover:bg-[#eef5f0] hover:text-[#10231d]"
                    }`}
                  >
                    <StepDot step={s.step} status={s.status} active={isActive} />
                    {open && (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`truncate text-sm font-semibold ${
                              isActive ? "text-[#0c2219]" : ""
                            }`}
                          >
                            {s.title}
                          </span>
                          {locked && (
                            <svg
                              viewBox="0 0 20 20"
                              className="h-3 w-3 flex-none text-[#7a9c90]"
                              fill="currentColor"
                              aria-hidden
                            >
                              <path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
                            </svg>
                          )}
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[11px] ${
                            isActive ? "text-[#1f4a3b]" : "text-[#7a9c90]"
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
          <div className="border-t border-[#cfe3d9] px-4 py-3 text-[11px] text-[#5a7d70]">
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
      <span className="relative z-10 flex h-7 w-7 flex-none items-center justify-center  bg-[#0e2a23] text-[#bdf2cf]">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center  text-[11px] font-bold ${
        active
          ? "bg-[#0e2a23] text-[#bdf2cf]"
          : status === "locked"
            ? "border border-dashed border-[#cfe3d9] bg-white text-[#7a9c90]"
            : "border border-[#cfe3d9] bg-white text-[#10231d]"
      }`}
    >
      {step}
    </span>
  );
}
