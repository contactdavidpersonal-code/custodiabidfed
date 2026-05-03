import Link from "next/link";

/**
 * App-wide 404. Mobile-friendly layout — single column, generous tap
 * targets, safe-area aware.
 */
export default function NotFound() {
  return (
    <main
      className="flex min-h-[100dvh] items-center bg-[#f7f7f3] px-4 py-12 text-[#10231d] md:px-6"
      style={{
        paddingTop: "calc(2rem + var(--safe-top))",
        paddingBottom: "calc(2rem + var(--safe-bottom))",
      }}
    >
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
          404
        </p>
        <h1 className="mt-2 font-serif text-2xl font-bold leading-tight md:text-3xl">
          That page doesn&apos;t exist.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#3f5a51] md:text-base">
          The link may be old, or the resource was moved. Try your workspace
          or head home.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/assessments"
            className="bg-[#0e2a23] px-5 py-3 text-center text-sm font-bold tracking-tight text-[#bdf2cf] transition-colors hover:bg-[#10342a]"
          >
            Go to workspace
          </Link>
          <Link
            href="/"
            className="border border-[#cfe3d9] bg-white px-5 py-3 text-center text-sm font-bold text-[#10231d] hover:bg-[#f1f6f3]"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
