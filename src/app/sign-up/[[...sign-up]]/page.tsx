import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#0a0f1e] px-6 py-20 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
            Create Founder Account
          </p>
          <h1 className="text-4xl font-black leading-tight md:text-6xl">
            Start the operating system for your CMMC Level 1 sprints.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Create your account, then use the protected dashboard to manage client intake,
            assign sprint stages, and keep every startup moving toward bid readiness.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-4 shadow-2xl">
          <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
        </div>
      </div>
    </main>
  );
}
