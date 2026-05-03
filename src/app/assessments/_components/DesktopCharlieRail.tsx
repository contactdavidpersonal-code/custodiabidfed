"use client";

import dynamic from "next/dynamic";
import { useBreakpoint } from "@/lib/use-breakpoint";

// Lazy-loaded — the rail is heavy (chat history, motion, SSE parser) and
// it's never needed on mobile. Skipping SSR keeps the initial workspace
// HTML lean for first paint on slow networks.
const ComplianceOfficerRail = dynamic(
  () => import("../ComplianceOfficerRail").then((m) => m.ComplianceOfficerRail),
  { ssr: false },
);

/**
 * Desktop-only mount for the persistent compliance officer rail.
 * On mobile/tablet the MobileCharlieFAB sheet handles chat instead, so
 * skipping the mount avoids the duplicate /api/chat history fetch.
 */
export function DesktopCharlieRail() {
  const bp = useBreakpoint();
  if (bp !== "desktop") return null;
  return <ComplianceOfficerRail />;
}
