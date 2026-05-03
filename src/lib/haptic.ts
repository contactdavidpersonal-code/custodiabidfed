/**
 * Trigger a tiny haptic vibration on supported mobile devices. Iphones
 * ignore the Vibration API but most Androids honor it. Always safe to
 * call — gracefully no-ops on desktop and unsupported browsers.
 *
 *   - "light"  — 8ms tap (button press)
 *   - "medium" — 14ms (state change)
 *   - "heavy"  — 22ms (confirmation)
 */
export function haptic(intensity: "light" | "medium" | "heavy" = "light"): void {
  if (typeof window === "undefined") return;
  const nav = window.navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  if (typeof nav.vibrate !== "function") return;
  const ms = intensity === "heavy" ? 22 : intensity === "medium" ? 14 : 8;
  try {
    nav.vibrate(ms);
  } catch {
    // Some browsers throw if vibrate is gated behind user interaction
    // permissions; silently ignore.
  }
}
