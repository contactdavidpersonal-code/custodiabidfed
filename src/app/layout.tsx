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
  title: "Custodia | TurboTax for CMMC Level 1",
  description:
    "Federal compliance for small contractors, in plain English. Charlie — your AI compliance officer — walks you through CMMC Level 1 in 7 days. $249/month, flat. 14-day free trial.",
  openGraph: {
    title: "Custodia | TurboTax for CMMC Level 1",
    description:
      "Federal bid-ready in 7 days. $249/month, flat. 14-day free trial. Built by Carnegie Mellon-trained information security engineers.",
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
