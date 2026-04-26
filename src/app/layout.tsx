import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist_Mono, Lora, Manrope } from "next/font/google";
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
  title: "Custodia | CMMC Level 1 Compliance for SMBs",
  description:
    "Guided CMMC Level 1 compliance for SMBs handling FCI. AI speed plus a Custodia compliance officer in the loop to help you build a defensible, bid-ready package.",
  openGraph: {
    title: "Custodia | CMMC Level 1 Compliance for SMBs",
    description:
      "Guided CMMC Level 1 compliance for SMBs handling FCI, with AI automation and officer support.",
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
          signInFallbackRedirectUrl="/assessments"
          signUpFallbackRedirectUrl="/assessments"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
