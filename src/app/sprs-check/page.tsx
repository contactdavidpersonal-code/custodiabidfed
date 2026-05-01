import type { Metadata } from "next";
import SprsCheckClient from "./SprsCheckClient";

export const metadata: Metadata = {
  title: "Free SPRS Self-Check | Custodia",
  description:
    "12 plain-English questions. Get a SPRS-style score primes recognize, plus a free PDF gap report. No login required.",
  robots: { index: true, follow: true },
};

export default function SprsCheckPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <SprsCheckClient />
    </main>
  );
}
