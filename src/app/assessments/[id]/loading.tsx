/**
 * Skeleton for the assessment workspace landing. Mirrors the dense control
 * grid the real page renders.
 */
export default function AssessmentLoading() {
  return (
    <div className="px-4 py-6 md:px-6 md:py-10" aria-busy="true">
      <div className="mx-auto max-w-5xl">
        <div className="h-3 w-40 animate-pulse bg-[#e3ede8]" />
        <div className="mt-2 h-7 w-64 max-w-full animate-pulse bg-[#dde8e2]" />
        <div className="mt-3 h-4 w-3/4 animate-pulse bg-[#e3ede8]" />

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border border-[#cfe3d9] bg-white p-4"
            >
              <div className="h-3 w-20 animate-pulse bg-[#e3ede8]" />
              <div className="mt-2 h-5 w-3/4 animate-pulse bg-[#dde8e2]" />
              <div className="mt-3 h-3 w-full animate-pulse bg-[#e3ede8]" />
              <div className="mt-1 h-3 w-2/3 animate-pulse bg-[#e3ede8]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
