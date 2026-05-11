import type { Metadata } from "next";
import type { ReactNode } from "react";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  title:
    "Monday Bid Digest — Federal opportunities for small CMMC L1 contractors",
  description:
    "A free, weekly digest of brand-new SAM.gov opportunities curated for small businesses that operate at CMMC Level 1. NAICS-targeted. No CUI-heavy programs. Delivered every Monday at 7am ET.",
  alternates: { canonical: `${APP_URL}/bid-digest` },
  robots: { index: true, follow: true },
};

export default function BidDigestLayout({ children }: { children: ReactNode }) {
  return children;
}
