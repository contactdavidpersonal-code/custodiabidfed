/**
 * Mobile-first skeleton shown while the opportunities pipeline streams
 * from SAM.gov. Matches the page's eventual layout (header strip + card
 * list) so the swap is visually quiet.
 */
export default function OpportunitiesLoading() {
  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]" aria-busy="true">
      <header className="border-b border-[#cfe3d9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-32 animate-pulse bg-[#e3ede8]" />
            <div className="mt-2 h-6 w-48 animate-pulse bg-[#dde8e2]" />
          </div>
          <div className="h-8 w-20 animate-pulse bg-[#e3ede8]" />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-[#cfe3d9] bg-white p-4 md:p-5"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="h-3 w-24 animate-pulse bg-[#e3ede8]" />
              <div className="mt-3 h-5 w-3/4 animate-pulse bg-[#dde8e2]" />
              <div className="mt-2 h-4 w-full animate-pulse bg-[#e3ede8]" />
              <div className="mt-1 h-4 w-5/6 animate-pulse bg-[#e3ede8]" />
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="h-6 w-16 animate-pulse bg-[#e3ede8]" />
                <div className="h-6 w-20 animate-pulse bg-[#e3ede8]" />
                <div className="h-6 w-14 animate-pulse bg-[#e3ede8]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
