import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#0e2a23] px-6 py-16 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <Link
            href="/"
            className="font-serif text-2xl font-bold tracking-tight text-white hover:text-[#bdf2cf]"
          >
            Custodia<span className="text-[#8dd2b1]">.</span>
          </Link>
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.22em] text-[#8dd2b1]">
            Start for free
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Build your{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              CMMC Level 1
            </span>{" "}
            package, free.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#a8cfc0]">
            No credit card. No time limit. Walk all 17 FAR 52.204-21 practices,
            draft your SSP, and upload evidence inside The Platform. Pay only when
            you&apos;re ready to ship the bid-ready package.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-[#cce5da]">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              Free forever &mdash; no credit card required
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              Officer-reviewed when you&apos;re ready to bid
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 font-bold text-[#8dd2b1]">&#10003;</span>
              Onboarded in under 5 minutes
            </li>
          </ul>
          <p className="mt-8 text-sm text-[#7aab98]">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-[#bdf2cf] hover:text-white">
              Login &rarr;
            </Link>
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/assessments" />
        </div>
      </div>
    </main>
  );
}
