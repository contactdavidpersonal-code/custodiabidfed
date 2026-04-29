import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist_Mono, Lora, Manrope } from "next/font/google";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Custodia | Add 6–7 Figures in Federal Revenue, Without a Compliance Team",
  description:
    "How established business owners are adding 6–7 figures in federal revenue — without a compliance team, an RFP chase, or a single disruption to their operations. CMMC Level 1 in plain English, weekly matched contracts, officer support.",
  openGraph: {
    title: "Custodia | Add 6–7 Figures in Federal Revenue",
    description:
      "Established owners are adding 6–7 figures in federal revenue with no compliance team and no RFP chase. CMMC L1 made simple. Free to build. One award covers years of subscription.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${lora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={clerkAppearance}
          signInFallbackRedirectUrl="/assessments"
          signUpFallbackRedirectUrl="/assessments"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
