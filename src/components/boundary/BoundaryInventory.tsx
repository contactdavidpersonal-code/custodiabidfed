/**
 * Boundary inventory tables — full enumerations of every in-scope, ESP, and
 * out-of-scope item. Pairs with BoundaryDiagram (which shows summaries).
 */

import type { BoundaryView } from "@/lib/cmmc/boundary";
import { flowChannelLabels, flowDirectionLabels } from "@/lib/cmmc/boundary";

export function BoundaryInventory({ view }: { view: BoundaryView }) {
  return (
    <>
      <h2 className="boundary">Out-of-scope (declared)</h2>
      {view.out_of_scope.length === 0 ? (
        <p style={{ fontSize: 12, color: "#44695c", fontStyle: "italic" }}>
          No items declared out of scope yet.
        </p>
      ) : (
        <table className="boundary">
          <thead>
            <tr>
              <th>Asset / system</th>
              <th>Why out of scope</th>
              <th>How segregated</th>
            </tr>
          </thead>
          <tbody>
            {view.out_of_scope.map((o) => (
              <tr key={o.id}>
                <td>{o.asset || <em style={{ color: "#a06b1a" }}>missing</em>}</td>
                <td>{o.reason || <em style={{ color: "#a06b1a" }}>missing reason</em>}</td>
                <td>
                  {o.segregation || (
                    <em style={{ color: "#a06b1a" }}>missing segregation rationale</em>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="boundary">Boundary inventory — quick view</h2>
      <table className="boundary">
        <thead>
          <tr>
            <th style={{ width: "25%" }}>Item</th>
            <th style={{ width: "18%" }}>Category</th>
            <th>Detail</th>
            <th style={{ width: "18%" }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {view.people.map((p) => (
            <tr key={p.id}>
              <td>{p.label}</td>
              <td>
                <span className="pill pill-in">In FCI</span>
              </td>
              <td>{p.role ?? "—"}</td>
              <td>
                <span className="source-stamp">declared</span>
              </td>
            </tr>
          ))}
          {view.technology.map((t) => (
            <tr key={t.id}>
              <td>{t.label}</td>
              <td>
                <span className="pill pill-in">In FCI</span>
              </td>
              <td>{t.role ?? t.notes ?? "—"}</td>
              <td>
                <span className="source-stamp">declared</span>
              </td>
            </tr>
          ))}
          {view.facilities.map((f) => (
            <tr key={f.id}>
              <td>{f.label}</td>
              <td>
                <span className="pill pill-in">In FCI</span>
              </td>
              <td>{f.role ?? f.notes ?? "Facility"}</td>
              <td>
                <span className="source-stamp">declared</span>
              </td>
            </tr>
          ))}
          {view.esps.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>
                <span className="pill pill-esp">ESP</span>
              </td>
              <td>{e.services ?? e.vendor ?? "—"}</td>
              <td>
                <span className="source-stamp">
                  {e.attestation_doc_url ? "attestation" : "declared"}
                </span>
              </td>
            </tr>
          ))}
          {view.scope_inventory_esps.map((e) => (
            <tr key={e.id}>
              <td>{e.label}</td>
              <td>
                <span className="pill pill-esp">ESP</span>
              </td>
              <td>{e.role ?? e.notes ?? "—"}</td>
              <td>
                <span className="source-stamp">declared</span>
              </td>
            </tr>
          ))}
          {view.out_of_scope.map((o) => (
            <tr key={`oos-${o.id}`}>
              <td>{o.asset}</td>
              <td>
                <span className="pill pill-out">Out</span>
              </td>
              <td>{o.segregation || o.reason}</td>
              <td>
                <span className="source-stamp">declared</span>
              </td>
            </tr>
          ))}
          {view.people.length === 0 &&
            view.technology.length === 0 &&
            view.facilities.length === 0 &&
            view.esps.length === 0 &&
            view.scope_inventory_esps.length === 0 &&
            view.out_of_scope.length === 0 && (
              <tr>
                <td colSpan={4} style={{ fontStyle: "italic", color: "#a06b1a" }}>
                  No inventory yet. Capture people, technology, ESPs, and out-of-scope items
                  to build the diagram.
                </td>
              </tr>
            )}
        </tbody>
      </table>

      {view.flows.length > 0 && (
        <>
          <h2 className="boundary">Data flows (full list)</h2>
          <table className="boundary">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Direction</th>
                <th style={{ width: "16%" }}>Channel</th>
                <th>Description</th>
                <th style={{ width: "20%" }}>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              {view.flows.map((f) => (
                <tr key={f.id}>
                  <td>{flowDirectionLabels[f.direction]}</td>
                  <td>{flowChannelLabels[f.channel]}</td>
                  <td>{f.description || <em style={{ color: "#a06b1a" }}>missing</em>}</td>
                  <td>{f.counterparty ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
