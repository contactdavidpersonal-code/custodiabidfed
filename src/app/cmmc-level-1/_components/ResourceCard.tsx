import type { ReactNode } from "react";

/**
 * Printable card container — the white "paper" each resource sits on.
 * Includes a standardized header (eyebrow + title + subtitle + stat strip).
 */
export function ResourceCard({
  eyebrow,
  title,
  italic,
  trailing,
  subtitle,
  stats,
  children,
}: {
  eyebrow: string;
  title: string;
  italic?: string;
  trailing?: string;
  subtitle: ReactNode;
  stats: Array<{ n: string; l: string }>;
  children: ReactNode;
}) {
  return (
    <article className="print-container mx-auto max-w-4xl border border-[#cfe3d9] bg-white p-8 shadow-[0_24px_80px_-30px_rgba(14,48,37,0.18)] md:p-14">
      <header className="border-b border-[#cfe3d9] pb-8">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-[#2f8f6d]">
          {eyebrow}
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-[1.05] tracking-tight text-[#10231d] md:text-[2.6rem]">
          {title}
          {italic ? (
            <>
              {" "}
              <span className="italic text-[#2f8f6d]">{italic}</span>
            </>
          ) : null}
          {trailing ? <> {trailing}</> : null}
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[#44695c]">
          {subtitle}
        </p>
        {stats.length > 0 && (
          <dl className="mt-8 grid grid-cols-3 divide-x divide-[#cfe3d9] border border-[#cfe3d9] bg-[#f7fcf9]">
            {stats.map((s) => (
              <div key={s.l} className="px-4 py-5 text-center md:px-6">
                <dt className="font-serif text-2xl font-bold text-[#10231d] md:text-3xl">
                  {s.n}
                </dt>
                <dd className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#2f8f6d]">
                  {s.l}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      <div className="pt-10">{children}</div>
    </article>
  );
}
