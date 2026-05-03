"use client";

import { useBreakpoint } from "@/lib/use-breakpoint";
import { ComplianceOfficerRail } from "../ComplianceOfficerRail";

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
