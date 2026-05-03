"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useKeyboardOpen } from "@/lib/use-breakpoint";
import { haptic } from "@/lib/haptic";

export type BottomNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Optional unread/notification count. */
  badge?: number;
  /** Mark active when pathname starts with this prefix instead of exact match. */
  matchPrefix?: boolean;
};

/**
 * App-style bottom tab bar. Hidden above mobile breakpoint via `lg:hidden`.
 * Auto-hides while the on-screen keyboard is open so it doesn't float on
 * top of focused inputs on iOS.
 * Safe-area padded so it sits above the iPhone home indicator.
 */
export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname() ?? "";
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#cfe3d9] bg-white/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {items.map((it) => {
          const active = it.matchPrefix
            ? pathname.startsWith(it.href)
            : pathname === it.href;
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (!active) haptic("light");
                }}
                className="relative flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              >
                <span
                  className={[
                    "relative flex h-6 w-6 items-center justify-center transition-colors",
                    active ? "text-[#0f2f26]" : "text-[#7aab98]",
                  ].join(" ")}
                  aria-hidden
                >
                  {it.icon}
                  {it.badge && it.badge > 0 ? (
                    <span className="absolute -right-1.5 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    active ? "text-[#0f2f26]" : "text-[#7aab98]"
                  }
                >
                  {it.label}
                </span>
                {active ? (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[#2f8f6d]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
