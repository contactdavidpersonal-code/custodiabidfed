import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#0a0f1e] px-6 py-20 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
            Founder Access
          </p>
          <h1 className="text-4xl font-black leading-tight md:text-6xl">
            Sign in to manage your CMMC sprint clients.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Your dashboard tracks startup clients from lead intake through SAM registration,
            SSP drafting, controls implementation, bid readiness, and ongoing retainer work.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-4 shadow-2xl">
          <SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
        </div>
      </div>
    </main>
  );
}
