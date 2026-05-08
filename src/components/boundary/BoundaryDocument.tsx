/**
 * Full SSP § 1.2 boundary artifact — header + diagram + legend + tables +
 * validation panel + footer note. This is the canonical render used both
 * inside the workspace page and in the standalone HTML export.
 */

import type { BoundaryView, ScopeFinding } from "@/lib/cmmc/boundary";
import { BoundaryDiagram } from "./BoundaryDiagram";
import { BoundaryInventory } from "./BoundaryInventory";
import { BoundaryValidation } from "./BoundaryValidation";

export function BoundaryDocument({
  view,
  findings,
}: {
  view: BoundaryView;
  findings: ScopeFinding[];
}) {
  const generated = new Date(view.generated_at);
  const generatedLabel = Number.isNaN(generated.getTime())
    ? "—"
    : generated.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  return (
    <div className="page">
      <div className="doc-header">
        <div className="eyebrow">SSP § 1.2 — Assessment &amp; FCI Boundary</div>
        <h1>{view.legal_entity.name} — FCI Boundary Diagram</h1>
        <div className="meta">
          <span>
            <b>Generated:</b> {generatedLabel}
          </span>
          <span>
            <b>SPRS confidence:</b> Self-Assessment, Level 1
          </span>
          {view.affirming_official ? (
            <span>
              <b>Affirming Official:</b> {view.affirming_official.name}
              {view.affirming_official.title ? `, ${view.affirming_official.title}` : ""}
            </span>
          ) : (
            <span style={{ color: "#b3261e" }}>
              <b>Affirming Official:</b> not yet captured
            </span>
          )}
          {view.legal_entity.cage && (
            <span>
              <b>CAGE:</b> {view.legal_entity.cage}
            </span>
          )}
          {view.legal_entity.naics.length > 0 && (
            <span>
              <b>NAICS:</b> {view.legal_entity.naics.join(", ")}
            </span>
          )}
        </div>
      </div>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--ink-soft)",
          maxWidth: 780,
        }}
      >
        This diagram defines the <b>FCI Boundary</b> for {view.legal_entity.name} for the
        purpose of FAR 52.204-21 safeguarding and the CMMC Level 1 self-assessment. All
        assets, personnel, and external service providers that store, process, or transmit
        Federal Contract Information (FCI) are inside the inner boundary. Everything
        outside is explicitly out of scope.
      </p>

      <div className="diagram-wrap">
        <BoundaryDiagram view={view} />
      </div>

      <div className="legend">
        <div>
          <span
            className="swatch"
            style={{ background: "#0e2a23" }}
          />
          <b>FCI Boundary</b> — assets that touch FCI
        </div>
        <div>
          <span
            className="swatch"
            style={{ background: "#fff", border: "2px solid #2f8f6d" }}
          />
          <b>Assessment Boundary</b> — the legal entity
        </div>
        <div>
          <span
            className="swatch"
            style={{ background: "#eef3fb", border: "1px solid #1f3d7a" }}
          />
          <b>External Service Provider</b> — flow-down required
        </div>
        <div>
          <span
            className="swatch"
            style={{ background: "#f0eee8", border: "1px dashed #5b554a" }}
          />
          <b>External</b> — out of network
        </div>
      </div>

      <BoundaryInventory view={view} />

      <h2 className="boundary">Validation checks (run automatically before SSP generation)</h2>
      <BoundaryValidation findings={findings} />

      {view.narrative && view.narrative.trim().length > 0 && (
        <>
          <h2 className="boundary">Narrative</h2>
          <p style={{ fontSize: 13, lineHeight: 1.55 }}>{view.narrative}</p>
        </>
      )}

      <p className="footer-note">
        <b>How this is generated.</b> Every box, label, and inventory row above is rendered
        from the typed scope_profile object captured during onboarding plus the live
        scope inventory. Edits in the intake form re-render the diagram on save. Validation
        rules block SSP generation until all{" "}
        <span style={{ color: "var(--red)", fontWeight: 700 }}>FAIL</span> items are
        resolved;{" "}
        <span style={{ color: "var(--amber)", fontWeight: 700 }}>WARN</span> items are
        surfaced to the affirming official for explicit acknowledgement.
      </p>
    </div>
  );
}
