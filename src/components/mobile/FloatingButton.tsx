"use client";

import { motion } from "motion/react";

type Props = {
  onClick: () => void;
  label: string;
  /** Sit above bottom nav (true) or stand alone (false). Default true. */
  aboveBottomNav?: boolean;
  badge?: boolean;
  children?: React.ReactNode;
};

/**
 * Floating Action Button — mobile/tablet only.
 */
export function FloatingButton({
  onClick,
  label,
  aboveBottomNav = true,
  badge,
  children,
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className="lg:hidden fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#2f8f6d] text-white shadow-[0_12px_30px_-6px_rgba(47,143,109,0.6)] hover:bg-[#287a5d]"
      style={{
        bottom: aboveBottomNav
          ? "calc(64px + var(--safe-bottom) + 12px)"
          : "calc(var(--safe-bottom) + 16px)",
      }}
    >
      {children}
      {badge ? (
        <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white" aria-hidden />
      ) : null}
    </motion.button>
  );
}
