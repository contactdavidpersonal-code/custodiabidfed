/**
 * Boundary diagram (SVG). Pure-function React component — same output whether
 * rendered server-side, client-side, or stamped into a static HTML export.
 *
 * The layout is deterministic and matches the visual contract in
 * public/boundary-diagram-preview.html. Lists overflow into the inventory
 * tables (BoundaryInventory) — the diagram itself only shows up to a small
 * fixed cap per box.
 */

import type { BoundaryView } from "@/lib/cmmc/boundary";

const MAX_PER_BOX = 4;

type Props = {
  view: BoundaryView;
};

function clip<T>(rows: T[]): { shown: T[]; hidden: number } {
  if (rows.length <= MAX_PER_BOX) return { shown: rows, hidden: 0 };
  return { shown: rows.slice(0, MAX_PER_BOX - 1), hidden: rows.length - (MAX_PER_BOX - 1) };
}

export function BoundaryDiagram({ view }: Props) {
  const people = clip(view.people);
  const tech = clip(view.technology);
  const allEsps: Array<{ name: string; vendor?: string | null; services?: string | null }> = [
    ...view.esps.map((e) => ({ name: e.name, vendor: e.vendor, services: e.services })),
    ...view.scope_inventory_esps.map((e) => ({ name: e.label, services: e.role })),
  ];
  const esps = clip(allEsps);
  const flows = clip(view.flows);

  const ariaLabel = `FCI boundary diagram for ${view.legal_entity.name}`;

  return (
    <svg
      className="boundary"
      viewBox="0 0 980 640"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <filter id="boundary-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="2"
            floodColor="#0e2a23"
            floodOpacity="0.10"
          />
        </filter>
      </defs>

      {/* OUTERMOST: External */}
      <rect
        x="10"
        y="10"
        width="960"
        height="620"
        fill="#f0eee8"
        stroke="#5b554a"
        strokeDasharray="6 4"
        strokeWidth="1.5"
      />
      <text
        x="26"
        y="34"
        fontSize="12"
        fontWeight="800"
        letterSpacing="2"
        fill="#5b554a"
      >
        EXTERNAL — OUT OF NETWORK
      </text>

      {/* External actors row */}
      <g fontSize="11" fill="#3d3a33">
        <rect x="36" y="56" width="200" height="48" fill="#fff" stroke="#bdb8a8" />
        <text x="136" y="76" textAnchor="middle" fontWeight="700">
          DoD Prime / Customer
        </text>
        <text x="136" y="92" textAnchor="middle">
          inbound FCI source
        </text>

        <rect x="250" y="56" width="200" height="48" fill="#fff" stroke="#bdb8a8" />
        <text x="350" y="76" textAnchor="middle" fontWeight="700">
          DoD SPRS
        </text>
        <text x="350" y="92" textAnchor="middle">
          sprs.dla.mil
        </text>

        <rect x="754" y="56" width="200" height="48" fill="#fff" stroke="#bdb8a8" />
        <text x="854" y="76" textAnchor="middle" fontWeight="700">
          Internet / Public
        </text>
        <text x="854" y="92" textAnchor="middle">
          marketing &amp; non-FCI
        </text>
      </g>

      {/* ASSESSMENT BOUNDARY */}
      <rect
        x="40"
        y="120"
        width="900"
        height="490"
        fill="#fff"
        stroke="#2f8f6d"
        strokeWidth="2"
      />
      <text
        x="58"
        y="142"
        fontSize="11"
        fontWeight="800"
        letterSpacing="2"
        fill="#2f8f6d"
      >
        ASSESSMENT BOUNDARY — {view.legal_entity.name.toUpperCase()}
      </text>

      {/* FCI BOUNDARY */}
      <rect
        x="70"
        y="158"
        width="540"
        height="430"
        fill="#f0fbf4"
        stroke="#0e2a23"
        strokeWidth="2.5"
        filter="url(#boundary-soft)"
      />
      <text
        x="88"
        y="182"
        fontSize="11"
        fontWeight="800"
        letterSpacing="2"
        fill="#0e2a23"
      >
        FCI BOUNDARY — STORES / PROCESSES / TRANSMITS FCI
      </text>

      {/* People */}
      <g>
        <rect x="88" y="200" width="240" height="116" fill="#fff" stroke="#0e2a23" />
        <text x="100" y="220" fontSize="11" fontWeight="800" fill="#0e2a23">
          PEOPLE ({view.people.length})
        </text>
        <g fontSize="11" fill="#10231d">
          {people.shown.map((p, i) => (
            <text key={p.id} x="100" y={242 + i * 18}>
              • {truncate(`${p.label}${p.role ? ` — ${p.role}` : ""}`, 38)}
            </text>
          ))}
          {people.hidden > 0 && (
            <text x="100" y={242 + people.shown.length * 18} fontStyle="italic" fill="#44695c">
              + {people.hidden} more — see inventory
            </text>
          )}
          {view.people.length === 0 && (
            <text x="100" y="242" fontStyle="italic" fill="#a06b1a">
              No people declared yet — add at least one in scope.
            </text>
          )}
        </g>
      </g>

      {/* Endpoints / Technology */}
      <g>
        <rect x="340" y="200" width="260" height="116" fill="#fff" stroke="#0e2a23" />
        <text x="352" y="220" fontSize="11" fontWeight="800" fill="#0e2a23">
          ENDPOINTS &amp; SYSTEMS ({view.technology.length})
        </text>
        <g fontSize="11" fill="#10231d">
          {tech.shown.map((t, i) => (
            <text key={t.id} x="352" y={242 + i * 18}>
              • {truncate(t.label, 36)}
            </text>
          ))}
          {tech.hidden > 0 && (
            <text x="352" y={242 + tech.shown.length * 18} fontStyle="italic" fill="#44695c">
              + {tech.hidden} more — see inventory
            </text>
          )}
          {view.technology.length === 0 && (
            <text x="352" y="242" fontStyle="italic" fill="#a06b1a">
              No technology declared yet.
            </text>
          )}
        </g>
      </g>

      {/* Storage / Processing summary */}
      <g>
        <rect x="88" y="332" width="512" height="98" fill="#fff" stroke="#0e2a23" />
        <text x="100" y="352" fontSize="11" fontWeight="800" fill="#0e2a23">
          FCI STORAGE / PROCESSING
        </text>
        <g fontSize="11" fill="#10231d">
          {storageHighlights(view).slice(0, 3).map((line, i) => (
            <text key={i} x="100" y={374 + i * 18}>
              • {truncate(line, 78)}
            </text>
          ))}
          {storageHighlights(view).length === 0 && (
            <text x="100" y="374" fontStyle="italic" fill="#a06b1a">
              Identify the SharePoint site / mailbox / fileshare that holds FCI.
            </text>
          )}
        </g>
      </g>

      {/* Flows */}
      <g>
        <rect x="88" y="446" width="512" height="124" fill="#fff" stroke="#0e2a23" />
        <text x="100" y="466" fontSize="11" fontWeight="800" fill="#0e2a23">
          FCI DATA FLOWS
        </text>
        <g fontSize="11" fill="#10231d">
          {flows.shown.map((f, i) => (
            <text key={f.id} x="100" y={488 + i * 18}>
              {flowGlyph(f.direction)} {flowDirectionWord(f.direction).toUpperCase()}: {truncate(
                describeFlow(f),
                88,
              )}
            </text>
          ))}
          {flows.hidden > 0 && (
            <text x="100" y={488 + flows.shown.length * 18} fontStyle="italic" fill="#44695c">
              + {flows.hidden} more flow{flows.hidden === 1 ? "" : "s"} — see inventory
            </text>
          )}
          {view.flows.length === 0 && (
            <text x="100" y="488" fontStyle="italic" fill="#a06b1a">
              No data flows declared. At minimum, document one inbound and one outbound channel.
            </text>
          )}
        </g>
      </g>

      {/* ESP column */}
      <g>
        <rect
          x="630"
          y="200"
          width="290"
          height="370"
          fill="#eef3fb"
          stroke="#1f3d7a"
          strokeWidth="1.5"
        />
        <text
          x="644"
          y="220"
          fontSize="11"
          fontWeight="800"
          letterSpacing="1"
          fill="#1f3d7a"
        >
          EXTERNAL SERVICE PROVIDERS ({allEsps.length})
        </text>
        <text x="644" y="236" fontSize="10" fill="#1f3d7a" fontStyle="italic">
          In-scope per CMMC scoping guidance
        </text>

        {esps.shown.map((e, i) => {
          const y = 252 + i * 60;
          return (
            <g key={i} fontSize="11" fill="#10231d">
              <rect x="644" y={y} width="262" height="52" fill="#fff" stroke="#1f3d7a" />
              <text x="656" y={y + 18} fontWeight="700">
                {truncate(e.name, 36)}
              </text>
              <text x="656" y={y + 34}>{truncate(e.services ?? e.vendor ?? "", 40)}</text>
            </g>
          );
        })}
        {esps.hidden > 0 && (
          <text
            x="644"
            y={252 + esps.shown.length * 60 + 16}
            fontSize="11"
            fontStyle="italic"
            fill="#1f3d7a"
          >
            + {esps.hidden} more ESP{esps.hidden === 1 ? "" : "s"} — see inventory
          </text>
        )}
        {allEsps.length === 0 && (
          <text x="644" y="270" fontSize="11" fontStyle="italic" fill="#a06b1a">
            No ESPs declared yet.
          </text>
        )}
      </g>

      {/* Off-screen description for screen readers */}
      <desc>{describeView(view)}</desc>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function flowGlyph(d: "inbound" | "outbound" | "internal"): string {
  if (d === "inbound") return "↓";
  if (d === "outbound") return "↑";
  return "↺";
}

function flowDirectionWord(d: "inbound" | "outbound" | "internal"): string {
  return d;
}

function describeFlow(f: BoundaryView["flows"][number]): string {
  const channelLabel =
    f.channel === "prime_portal"
      ? "Prime portal"
      : f.channel === "removable_media"
        ? "Removable media"
        : f.channel === "internal_sync"
          ? "Internal sync"
          : f.channel.charAt(0).toUpperCase() + f.channel.slice(1);
  const cp = f.counterparty ? ` (${f.counterparty})` : "";
  return f.description ? `${f.description}${cp}` : `${channelLabel}${cp}`;
}

function storageHighlights(view: BoundaryView): string[] {
  // Pick technology rows whose role/notes look storage-y; otherwise list label only.
  return view.technology
    .filter((t) => t.handles_fci)
    .map((t) => {
      const detail = (t.role ?? t.notes ?? "").trim();
      return detail ? `${t.label} — ${detail}` : t.label;
    });
}

function describeView(view: BoundaryView): string {
  const parts: string[] = [];
  parts.push(
    `Assessment boundary for ${view.legal_entity.name}. ${view.people.length} people, ${view.technology.length} technology assets, and ${view.esps.length + view.scope_inventory_esps.length} external service providers are inside the FCI boundary.`,
  );
  if (view.out_of_scope.length > 0) {
    parts.push(`${view.out_of_scope.length} items are explicitly declared out of scope.`);
  }
  if (view.affirming_official) {
    parts.push(
      `Affirming official: ${view.affirming_official.name} (${view.affirming_official.title}).`,
    );
  }
  return parts.join(" ");
}
