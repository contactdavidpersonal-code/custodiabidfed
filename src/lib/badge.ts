import type { TrustHealth } from "@/lib/trust-status";

/**
 * Pure SVG badge renderer. No external fonts, no runtime deps. The output
 * is safe to cache at the edge. All text is escaped for XML.
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

const NAVY = "#0f172a";
const AMBER = "#f59e0b";
const WHITE = "#ffffff";
const SUBTLE = "#cbd5e1";

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
  const orgClipped = esc(clip(orgName, 28));
  const idLine = esc(custodiaVerificationId);
  const lastLine = esc(`Verified ${fmtRelative(lastVerifiedAt)}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Custodia Verified — ${orgClipped}">
  <rect width="${W}" height="${H}" rx="6" fill="${NAVY}"/>
  <rect x="0" y="0" width="6" height="${H}" fill="${AMBER}"/>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" fill="${WHITE}">
    <text x="14" y="18" font-size="9" font-weight="700" letter-spacing="1.2" fill="${AMBER}">CUSTODIA VERIFIED</text>
    <text x="14" y="34" font-size="11" font-weight="600">${orgClipped}</text>
    <text x="14" y="48" font-size="9" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${SUBTLE}">${idLine}</text>
  </g>
  <g transform="translate(${W - 78},14)">
    <circle cx="6" cy="6" r="5" fill="${colors.fill}"/>
    <text x="16" y="10" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="10" font-weight="700" fill="${WHITE}">${esc(colors.label)}</text>
    <text x="0" y="32" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="8" fill="${SUBTLE}">${lastLine}</text>
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
  const orgClipped = esc(clip(orgName, 16));
  const idLine = esc(custodiaVerificationId);
  const lastLine = esc(fmtRelative(lastVerifiedAt));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}" role="img" aria-label="Custodia Verified — ${orgClipped}">
  <rect width="${SZ}" height="${SZ}" rx="8" fill="${NAVY}"/>
  <rect x="0" y="0" width="${SZ}" height="6" fill="${AMBER}"/>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" fill="${WHITE}" text-anchor="middle">
    <text x="60" y="26" font-size="8" font-weight="700" letter-spacing="1.2" fill="${AMBER}">CUSTODIA</text>
    <text x="60" y="38" font-size="8" font-weight="700" letter-spacing="1.2" fill="${AMBER}">VERIFIED</text>
    <circle cx="60" cy="60" r="11" fill="${colors.fill}"/>
    <text x="60" y="84" font-size="9" font-weight="700">${esc(colors.label)}</text>
    <text x="60" y="98" font-size="9" font-weight="600">${orgClipped}</text>
    <text x="60" y="111" font-size="7" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${SUBTLE}">${idLine}</text>
    <text x="60" y="118" font-size="6" fill="${SUBTLE}">${lastLine}</text>
  </g>
</svg>`;
}
