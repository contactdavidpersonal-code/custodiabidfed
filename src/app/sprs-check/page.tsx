import type { Metadata } from "next";
import SprsCheckClient from "./SprsCheckClient";

export const metadata: Metadata = {
  title: "Free Federal Cyber Readiness Check | Custodia",
  description:
    "Twelve plain-English questions. Two minutes. Get the same Supplier Performance Risk System (SPRS) score that primes look for, plus a free gap report. No login required.",
  robots: { index: true, follow: true },
};

export default function SprsCheckPage() {
  return (
    <main className="min-h-screen bg-[#0d2e25] text-white">
      <SprsCheckClient />
    </main>
  );
}
