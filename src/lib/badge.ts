import type { TrustHealth } from "@/lib/trust-status";

/**
 * Pure SVG badge renderer. No external fonts, no runtime deps. The output
 * is safe to cache at the edge. All text is escaped for XML.
 *
 * Visual: a Custodia shield in brand navy with the amber accent stripe,
 * a centered "C" mark, a live health dot, and the "CUSTODIA VERIFIED"
 * lockup. The whole badge is wrapped in an `<a>` at the embed-snippet
 * layer so clicking goes to the customer's public Verified page.
 */

export interface BadgeInput {
  orgName: string;
  custodiaVerificationId: string;
  health: TrustHealth;
  lastVerifiedAt: string | null;
  size: "wide" | "square";
}

const HEALTH_COLORS: Record<TrustHealth, { fill: string; label: string }> = {
  green: { fill: "#10b981", label: "Healthy" },
  amber: { fill: "#f59e0b", label: "Drift" },
  red: { fill: "#ef4444", label: "Action required" },
  gray: { fill: "#94a3b8", label: "Pending" },
};

// Custodia brand palette — kept in sync with the app shell.
const NAVY = "#10231d";
const NAVY_DEEP = "#0a1814";
const AMBER = "#f59e0b";
const EMERALD = "#2f8f6d";
const WHITE = "#ffffff";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "pending";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Custodia shield mark — a classic heater-shield silhouette in brand
 * navy with an amber crown stripe, a thin emerald inner border, and a
 * centered serif "C". Designed to read at 32px and scale up cleanly.
 *
 * The shield is drawn in its own 64×72 coordinate space so it can be
 * placed via `<g transform="translate(x,y) scale(s)">` without doing
 * arithmetic at every call site.
 *
 * @param healthFill — color of the live status dot at the shield's notch.
 */
function shieldMark(healthFill: string): string {
  return `
    <g>
      <path d="M 4 4 L 60 4 L 60 36 Q 60 56 32 70 Q 4 56 4 36 Z" fill="${NAVY}"/>
      <path d="M 4 4 L 60 4 L 60 14 L 4 14 Z" fill="${AMBER}"/>
      <path d="M 4 4 L 60 4 L 60 36 Q 60 56 32 70 Q 4 56 4 36 Z" fill="none" stroke="${EMERALD}" stroke-width="1.5"/>
      <text x="32" y="50" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" text-anchor="middle" fill="${WHITE}">C</text>
      <circle cx="52" cy="58" r="5" fill="${healthFill}" stroke="${NAVY_DEEP}" stroke-width="1.5"/>
    </g>`;
}

export function renderBadge(input: BadgeInput): string {
  return input.size === "square" ? renderSquare(input) : renderWide(input);
}

function renderWide({
  orgName,
  custodiaVerificationId,
  health,
  lastVerifiedAt,
}: BadgeInput): string {
  const W = 240;
  const H = 60;
  const colors = HEALTH_COLORS[health];
  const orgClipped = esc(clip(orgName, 24));
  const idLine = esc(custodiaVerificationId);
  const ariaLabel = `Custodia Verified — ${orgClipped} — CMMC Level 1 self-attested — ${esc(colors.label)} — Verified ${fmtRelative(lastVerifiedAt)}`;

  // Layout: shield on the left (48×54 inside an 8px margin), lockup on the right.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ariaLabel}">
  <rect width="${W}" height="${H}" rx="6" fill="${WHITE}" stroke="${NAVY}" stroke-width="1"/>
  <g transform="translate(8 3) scale(0.75)">
    ${shieldMark(colors.fill)}
  </g>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
    <text x="64" y="18" font-size="9" font-weight="700" letter-spacing="1.4" fill="${EMERALD}">CUSTODIA VERIFIED</text>
    <text x="64" y="34" font-size="11" font-weight="700" fill="${NAVY}">${orgClipped}</text>
    <text x="64" y="48" font-size="9" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${NAVY}">${idLine}</text>
  </g>
</svg>`;
}

function renderSquare({
  orgName,
  custodiaVerificationId,
  health,
  lastVerifiedAt,
}: BadgeInput): string {
  const SZ = 120;
  const colors = HEALTH_COLORS[health];
  const orgClipped = esc(clip(orgName, 14));
  const idLine = esc(custodiaVerificationId);
  const ariaLabel = `Custodia Verified — ${orgClipped} — CMMC Level 1 self-attested — ${esc(colors.label)} — Verified ${fmtRelative(lastVerifiedAt)}`;

  // Layout: shield centered top, lockup below. Shield is drawn in 64×72,
  // scaled 0.85 → 54×61, horizontally centered with translate(33, 8).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}" role="img" aria-label="${ariaLabel}">
  <rect width="${SZ}" height="${SZ}" rx="8" fill="${WHITE}" stroke="${NAVY}" stroke-width="1"/>
  <g transform="translate(33 8) scale(0.85)">
    ${shieldMark(colors.fill)}
  </g>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" text-anchor="middle">
    <text x="60" y="84" font-size="8" font-weight="700" letter-spacing="1.4" fill="${EMERALD}">CUSTODIA VERIFIED</text>
    <text x="60" y="100" font-size="9" font-weight="700" fill="${NAVY}">${orgClipped}</text>
    <text x="60" y="114" font-size="7" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${NAVY}">${idLine}</text>
  </g>
</svg>`;
}
