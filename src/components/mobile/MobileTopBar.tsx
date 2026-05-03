"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";

type Props = {
  /** Page title in the center. */
  title: string;
  /** Back link href. If omitted, no back button rendered. */
  backHref?: string;
  /** Right-side slot — usually a menu button or avatar. */
  right?: React.ReactNode;
  /** Subtitle / breadcrumb under the title. */
  subtitle?: string;
};

/**
 * Compact mobile-only top bar that shrinks slightly on scroll.
 * Hidden on lg+ (desktop keeps the existing header).
 */
export function MobileTopBar({ title, backHref, right, subtitle }: Props) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));
  return (
    <header
      className="lg:hidden sticky top-0 z-30 border-b border-[#cfe3d9] bg-white/95 backdrop-blur"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <motion.div
        animate={{ paddingTop: scrolled ? 6 : 12, paddingBottom: scrolled ? 6 : 12 }}
        transition={{ duration: 0.18 }}
        className="mx-auto flex max-w-3xl items-center gap-3 px-4"
      >
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0f2f26] hover:bg-[#f1f6f3]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        ) : (
          <div className="h-9 w-9 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate font-serif text-base font-bold text-[#0f2f26]">
            {title}
          </div>
          {subtitle ? (
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-end">{right}</div>
      </motion.div>
    </header>
  );
}
