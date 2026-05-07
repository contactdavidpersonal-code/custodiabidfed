import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { requireAdmin } from "@/lib/security/admin-auth";

/**
 * Admin console layout.
 *
 * SECURITY: requireAdmin() runs on every request to every /admin/* route.
 * This is the only authorization check that matters — the AdminLink in the
 * marketing/workspace headers is just UX. A non-admin who guesses the URL
 * lands on / via redirect.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[#0d2e25] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a2620]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:gap-6 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="flex items-center gap-2">
              <img src="/custodia-logo.png" alt="Custodia" className="h-8 w-auto" />
              <span className="font-serif text-xl font-bold tracking-tight">
                Admin<span className="text-[#bdf2cf]">.</span>
              </span>
            </Link>
            <span className="hidden border-l border-white/10 pl-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8ec3b1] md:inline">
              Restricted &mdash; admin only
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <AdminNavLink href="/admin">Pipeline</AdminNavLink>
            <AdminNavLink href="/admin/prospects">Prospects</AdminNavLink>
            <AdminNavLink href="/admin/contacts">Contacts</AdminNavLink>
            <AdminNavLink href="/admin/sources">Sources</AdminNavLink>
            <AdminNavLink href="/admin/conversions">Conversions</AdminNavLink>
            <div className="mx-2 h-6 w-px bg-white/10" />
            <Link
              href="/"
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#8ec3b1] hover:text-white"
            >
              Exit
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm font-medium text-[#cce5da] transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}
