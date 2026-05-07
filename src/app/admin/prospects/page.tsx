import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminProspectsPage() {
  return (
    <PlaceholderShell
      title="Prospects"
      desc="Companies discovered from USAspending awards, scored by ICP. Approve to flow contacts into the cold email queue."
      next="Phase 1 next: USAspending client + ICP scorer + discovery cron."
    />
  );
}

function PlaceholderShell({
  title,
  desc,
  next,
}: {
  title: string;
  desc: string;
  next: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#bdf2cf]">
          Pipeline
        </p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight md:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">{desc}</p>
      </header>
      <div className="border border-dashed border-white/15 bg-[#0a2620] p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8ec3b1]">
          Not implemented yet
        </p>
        <p className="mt-3 text-sm text-white/70">{next}</p>
        <Link
          href="/admin"
          className="mt-5 inline-block border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#cce5da] hover:border-[#bdf2cf] hover:text-white"
        >
          ← Back to pipeline
        </Link>
      </div>
    </div>
  );
}
