import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d2e25",
  interactiveWidget: "resizes-content",
};

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bidfedcmmc.com"
).replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Custodia | Guided CMMC Level 1 Compliance",
    template: "%s | Custodia",
  },
  description:
    "Federal compliance for small contractors, in plain English. Charlie — your AI compliance officer — walks you through CMMC Level 1 in 7 days. $249/month Self Service, or $397/month with a credentialed human Custodia Compliance Officer assigned to your account (ticket-based, 1 business day response). Save 2 months on annual. 14-day free trial. No credit card required.",
  applicationName: "Custodia",
  keywords: [
    "CMMC Level 1",
    "FAR 52.204-21",
    "SPRS affirmation",
    "DoD cybersecurity",
    "small business CMMC",
    "FCI compliance",
    "CMMC self-assessment",
    "DFARS 252.204-7021",
    "32 CFR Part 170",
    "NIST 800-171",
  ],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Custodia",
  },
  openGraph: {
    title: "Custodia | Guided CMMC Level 1 Compliance",
    description:
      "Federal bid-ready in 7 days. $249/month Self Service or $397/month with a human Custodia Compliance Officer assigned to your account. 14-day free trial. No credit card required. Built by Carnegie Mellon-trained information security engineers.",
    type: "website",
    url: APP_URL,
    siteName: "Custodia",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Custodia | Guided CMMC Level 1 Compliance",
    description:
      "Federal bid-ready in 7 days. Plain-English CMMC Level 1 for small DoD contractors. 14-day free trial.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

// Sitewide JSON-LD: Organization + WebSite (with SearchAction for sitelinks).
// Emitted once in the root layout so every page inherits the structured data
// signal Google needs to render brand panels, sitelinks, and AI Overviews.
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Custodia",
  alternateName: "BidFedCMMC",
  url: APP_URL,
  logo: `${APP_URL}/custodia-logo.png`,
  description:
    "Custodia is the guided self-serve platform that walks small DoD contractors and subcontractors through a CMMC Level 1 annual SPRS affirmation cycle in plain English.",
  sameAs: [
    "https://www.linkedin.com/company/bidfedcmmc",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "hello@bidfedcmmc.com",
      url: `${APP_URL}/`,
      areaServed: "US",
      availableLanguage: ["en"],
    },
  ],
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Custodia",
  url: APP_URL,
  inLanguage: "en-US",
  publisher: { "@type": "Organization", name: "Custodia", url: APP_URL },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${APP_URL}/blog?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSONLD),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(WEBSITE_JSONLD),
          }}
        />
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
