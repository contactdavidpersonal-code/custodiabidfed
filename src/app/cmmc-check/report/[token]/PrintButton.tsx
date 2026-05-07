"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-[#10231d] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0a1813]"
    >
      Print / Save PDF
    </button>
  );
}
