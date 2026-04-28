import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
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
            Welcome back
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Sign in to your{" "}
            <span className="bg-gradient-to-br from-[#d4f9e0] via-[#8dd2b1] to-[#5fb893] bg-clip-text text-transparent">
              CMMC workspace
            </span>
            .
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#a8cfc0]">
            Pick up where you left off &mdash; controls walked, evidence uploaded,
            SSP narratives drafted. Your bid-ready package is waiting.
          </p>
          <p className="mt-8 text-sm text-[#7aab98]">
            New to Custodia?{" "}
            <Link href="/sign-up" className="font-bold text-[#bdf2cf] hover:text-white">
              Start free &rarr;
            </Link>
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/assessments" />
        </div>
      </div>
    </main>
  );
}
