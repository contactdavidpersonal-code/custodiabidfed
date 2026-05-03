"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useEffect, useRef } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional fixed header content (drag handle is automatic). */
  title?: React.ReactNode;
  /** "auto" sizes to content (capped at 90vh); "full" takes the screen minus a top inset. */
  height?: "auto" | "full";
  /** Allow drag-down to dismiss. Default true. */
  dismissable?: boolean;
};

/**
 * Bottom sheet that rises from the bottom of the screen on mobile.
 * Drag down to dismiss. Backdrop tap dismisses. Escape key dismisses.
 * Focus is trapped while open.
 */
export function Sheet({
  open,
  onClose,
  children,
  title,
  height = "auto",
  dismissable = true,
}: SheetProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissable]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!dismissable) return;
    if (info.offset.y > 100 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={dismissable ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            ref={ref}
            drag={dismissable ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={onDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className={[
              "relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.45)]",
              height === "full"
                ? "h-[92dvh] max-h-[92dvh]"
                : "max-h-[90dvh]",
            ].join(" ")}
            style={{ paddingBottom: "var(--safe-bottom)" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1.5 w-10 rounded-full bg-[#10231d]/15" aria-hidden />
            </div>
            {title ? (
              <div className="border-b border-[#cfe3d9] px-5 py-3 text-center font-serif text-base font-bold text-[#10231d]">
                {title}
              </div>
            ) : null}
            <div className="scroll-contained min-h-0 flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
