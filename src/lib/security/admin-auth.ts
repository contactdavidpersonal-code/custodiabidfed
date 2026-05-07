/**
 * Admin authentication gate.
 *
 * Source of truth: Clerk `publicMetadata.role === "admin"` on the user.
 * Set this in the Clerk dashboard → Users → (you) → Public metadata:
 *
 *     { "role": "admin" }
 *
 * Why publicMetadata and not privateMetadata: publicMetadata is exposed to
 * the client SDK (`useUser().user.publicMetadata.role`) so we can
 * conditionally render the admin nav button without a server round-trip.
 * Authorization itself still happens server-side here — the client read is
 * UX only.
 *
 * Use `requireAdmin()` in server components / server actions / route
 * handlers. Use `isAdmin()` when you need a non-throwing boolean.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Returns true iff the current Clerk user has publicMetadata.role === "admin".
 * Non-throwing. Use for conditional UI on the server.
 */
export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  if (!user) return false;
  return user.publicMetadata?.role === "admin";
}

/**
 * Hard gate. Redirects unauthenticated users to /sign-in and signed-in
 * non-admins to /. Throws via redirect — never returns false.
 *
 * Returns the userId for convenience.
 */
export async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/admin");
  const user = await currentUser();
  if (!user || user.publicMetadata?.role !== "admin") {
    // Do not leak admin URL existence to non-admins. Bounce home.
    redirect("/");
  }
  return userId;
}
