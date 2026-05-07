"use client";

/**
 * Admin nav link — only renders when the signed-in Clerk user has
 * publicMetadata.role === "admin". The link itself is decorative; the real
 * authorization gate is `requireAdmin()` on the server.
 */

import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type Props = {
  /** Tailwind class string. Pass whatever matches the surrounding nav. */
  className?: string;
  /** Optional label override. Default: "Admin". */
  label?: string;
};

export function AdminLink({ className, label = "Admin" }: Props) {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded || !isSignedIn) return null;
  if (user?.publicMetadata?.role !== "admin") return null;
  return (
    <Link href="/admin" prefetch={false} className={className}>
      {label}
    </Link>
  );
}
