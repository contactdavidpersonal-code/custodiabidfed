"use client";

import { BottomNav } from "@/components/mobile/BottomNav";

export function WorkspaceBottomNav({ unreadTickets }: { unreadTickets: number }) {
  return (
    <BottomNav
      items={[
        {
          href: "/assessments",
          label: "Workspace",
          matchPrefix: true,
          icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l9-9 9 9" />
              <path d="M5 10v10h14V10" />
            </svg>
          ),
        },
        {
          href: "/opportunities",
          label: "Bids",
          matchPrefix: true,
          icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h18M3 12h18M3 17h12" />
            </svg>
          ),
        },
        {
          href: "/assessments/tickets",
          label: "Tickets",
          matchPrefix: true,
          badge: unreadTickets,
          icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4z" />
              <path d="M9 5v14" />
            </svg>
          ),
        },
        {
          href: "/profile/bid-ready",
          label: "Profile",
          matchPrefix: true,
          icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          ),
        },
      ]}
    />
  );
}
