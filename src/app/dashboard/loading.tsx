/**
 * Generic dashboard skeleton — used while the officer's client list and
 * escalation feed load.
 */
export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#10231d]" aria-busy="true">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <div className="h-3 w-32 animate-pulse bg-[#e3ede8]" />
        <div className="mt-2 h-7 w-56 max-w-full animate-pulse bg-[#dde8e2]" />

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-[#cfe3d9] bg-white p-4">
              <div className="h-3 w-20 animate-pulse bg-[#e3ede8]" />
              <div className="mt-2 h-8 w-16 animate-pulse bg-[#dde8e2]" />
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-[#cfe3d9] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-3/5 animate-pulse bg-[#dde8e2]" />
                  <div className="mt-2 h-3 w-2/5 animate-pulse bg-[#e3ede8]" />
                </div>
                <div className="h-6 w-16 animate-pulse bg-[#e3ede8]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
