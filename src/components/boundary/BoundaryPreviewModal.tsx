"use client";

/**
 * Click-to-zoom wrapper for the boundary diagram. Renders the children
 * inline as a clickable thumbnail; on click, opens a fullscreen modal with
 * zoom in/out/reset controls and a "Download PDF" action that hits
 * /api/boundary/render?print=1 (auto-fires the browser print dialog so the
 * user can save as PDF). Server components render <BoundaryDocument /> as
 * the children — this component is purely the presentation shell.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

export function BoundaryPreviewModal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setZoom(1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "+" || e.key === "=")
        setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
      if (e.key === "-" || e.key === "_")
        setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
      if (e.key === "0") setZoom(1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom((z) => {
      const next = z + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +next.toFixed(2)));
    });
  };

  return (
    <>
      {/*
        IMPORTANT: this trigger MUST be a <div role="button"> rather than a
        <button>. The boundary document children contain block-level elements
        (<section>, <table>, <div>) and HTML disallows those inside <button>;
        browsers re-parent them, breaking React hydration and crashing the
        server-component tree. role="button" + tabIndex + key handlers gives
        us the same a11y surface without the parsing hazard.
      */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label="Open boundary diagram in larger view"
        className="group relative block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
      >
        <div className="overflow-x-auto">{children}</div>
        <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-3">
          <span className="bg-[#0e2a23]/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white opacity-0 shadow-sm transition group-hover:opacity-100">
            Click to enlarge
          </span>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Boundary diagram preview"
          className="fixed inset-0 z-[100] flex flex-col bg-[#0e2a23]/85"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#cfe3d9]/40 bg-[#10231d] px-5 py-3 text-white">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ec5b5]">
                SSP § 1.2 · FCI Boundary
              </div>
              <div className="font-serif text-sm">
                Review boundary &mdash; pinch / scroll to zoom, drag to pan
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-[#cfe3d9]/40">
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) =>
                      Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)),
                    )
                  }
                  className="px-3 py-1.5 text-sm font-bold hover:bg-white/10"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="min-w-[3.5rem] border-x border-[#cfe3d9]/40 px-2 py-1.5 text-center text-xs tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) =>
                      Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)),
                    )
                  }
                  className="px-3 py-1.5 text-sm font-bold hover:bg-white/10"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="border border-[#cfe3d9]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10"
              >
                Reset
              </button>
              <a
                href="/api/boundary/render?print=1"
                target="_blank"
                rel="noreferrer"
                className="border border-[#2f8f6d] bg-[#2f8f6d] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#247a5b]"
              >
                Download PDF
              </a>
              <a
                href="/api/boundary/render"
                target="_blank"
                rel="noreferrer"
                className="border border-[#cfe3d9]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10"
              >
                Standalone HTML
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="border border-[#cfe3d9]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10"
              >
                Close · Esc
              </button>
            </div>
          </div>
          <div
            ref={scrollRef}
            onWheel={onWheel}
            className="flex-1 overflow-auto bg-[#f7faf8] p-6"
            onClick={(e) => {
              // close when clicking the empty backdrop, but not the document
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 120ms ease-out",
                width: "fit-content",
                margin: "0 auto",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
