/**
 * Validation findings panel — pass / warn / fail rows in the same visual
 * style as the approved preview (.v-pass, .v-warn, .v-fail).
 */

import type { ScopeFinding } from "@/lib/cmmc/boundary";

export function BoundaryValidation({ findings }: { findings: ScopeFinding[] }) {
  if (findings.length === 0) {
    return (
      <div className="validation">
        <div className="validation-row v-pass">
          <span className="icon">✓</span>
          <div>No findings. Boundary captured.</div>
        </div>
      </div>
    );
  }

  // Order: fail → warn → pass so the most actionable rows are visible first.
  const order: Record<ScopeFinding["level"], number> = { fail: 0, warn: 1, pass: 2 };
  const sorted = [...findings].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <div className="validation">
      {sorted.map((f) => (
        <div key={f.code} className={`validation-row v-${f.level}`}>
          <span className="icon">{iconFor(f.level)}</span>
          <div>
            <b>{titleFor(f)}.</b> {f.message}
            {f.control_refs && f.control_refs.length > 0 && (
              <>
                {" "}
                <span style={{ color: "#44695c", fontSize: 11 }}>
                  ({f.control_refs.join(", ")})
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function iconFor(level: ScopeFinding["level"]): string {
  if (level === "pass") return "✓";
  if (level === "warn") return "!";
  return "✕";
}

function titleFor(f: ScopeFinding): string {
  // Humanize the code as a short title; the message provides the detail.
  const map: Record<string, string> = {
    PEOPLE_EMPTY: "No in-scope people",
    PEOPLE_OK: "People in FCI scope identified",
    STORAGE_EMPTY: "No technology assets in scope",
    STORAGE_OK: "FCI storage identified",
    ESP_EMPTY: "No ESPs declared",
    ESP_OK: "External Service Providers declared",
    OOS_EMPTY: "Out-of-scope list empty",
    OOS_INCOMPLETE: "Out-of-scope items incomplete",
    OOS_OK: "Out-of-scope list complete",
    FLOWS_NO_INBOUND: "No inbound FCI flow",
    FLOWS_NO_OUTBOUND: "No outbound FCI flow",
    REMOVABLE_MEDIA_NO_FACILITY: "Removable-media flow without a facility",
    STORAGE_PUBLIC_SHARING: "Public sharing detected on FCI asset",
    AO_MISSING: "Affirming official missing",
    AO_INCOMPLETE: "Affirming official incomplete",
    AO_NOT_ACK: "Affirming official has not acknowledged",
    AO_OK: "Affirming official acknowledged",
    ENTITY_NAME_MISSING: "Legal entity name placeholder",
    ENTITY_NAICS_MISSING: "NAICS codes missing",
  };
  return map[f.code] ?? f.code;
}
