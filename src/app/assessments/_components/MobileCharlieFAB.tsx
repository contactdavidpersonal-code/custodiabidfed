"use client";

import { useState } from "react";
import { Sheet } from "@/components/mobile/Sheet";
import { FloatingButton } from "@/components/mobile/FloatingButton";
import { ComplianceOfficerRail } from "../ComplianceOfficerRail";

/**
 * Mobile/tablet only: floating Charlie button that opens the compliance
 * officer chat in a full-height bottom sheet. Hidden on desktop (where the
 * persistent right rail handles this).
 */
export function MobileCharlieFAB() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FloatingButton
        onClick={() => setOpen(true)}
        label="Open Charlie, your virtual compliance officer"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
          <circle cx="9" cy="12" r="0.8" fill="currentColor" />
          <circle cx="13" cy="12" r="0.8" fill="currentColor" />
          <circle cx="17" cy="12" r="0.8" fill="currentColor" />
        </svg>
      </FloatingButton>
      <Sheet open={open} onClose={() => setOpen(false)} height="full">
        <ComplianceOfficerRail mobile />
      </Sheet>
    </>
  );
}
