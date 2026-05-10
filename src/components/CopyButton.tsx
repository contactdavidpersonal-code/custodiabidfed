"use client";

import { useState } from "react";

export function CopyButton({
  code,
  label = "Copy",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select-all via temp textarea
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
