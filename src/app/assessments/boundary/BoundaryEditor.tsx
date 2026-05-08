"use client";

/**
 * BoundaryEditor — client-side intake panel paired with the live diagram.
 *
 * Layout: 2-col grid. Left = the BoundaryDocument render. Right = the
 * stepper/editor for the three pieces of data only the affirming official
 * can supply (flows, out-of-scope items, affirming-official block, narrative).
 * People / technology / facilities / ESPs come from the existing
 * scope_inventory + esp_registry tables — those live in their own pages.
 *
 * Save flow: optimistic local state → PATCH /api/boundary → server returns
 * fresh view + findings → replace local state.
 */

import { useState, useTransition } from "react";
import {
  BoundaryDocument,
} from "@/components/boundary";
import {
  flowChannelLabels,
  flowDirectionLabels,
  type AffirmingOfficial,
  type BoundaryView,
  type FlowChannel,
  type FlowDirection,
  type OutOfScopeItem,
  type ScopeFinding,
  type ScopeFlow,
} from "@/lib/cmmc/boundary";

type Props = {
  initialView: BoundaryView;
  initialFindings: ScopeFinding[];
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function BoundaryEditor({ initialView, initialFindings }: Props) {
  const [view, setView] = useState<BoundaryView>(initialView);
  const [findings, setFindings] = useState<ScopeFinding[]>(initialFindings);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const ao: AffirmingOfficial =
    view.affirming_official ?? {
      name: "",
      title: "",
      email: "",
      acknowledged_at: null,
    };

  function persist(patch: {
    flows?: ScopeFlow[];
    out_of_scope?: OutOfScopeItem[];
    affirming_official?: AffirmingOfficial | null;
    narrative?: string | null;
  }) {
    startTransition(async () => {
      setSaveError(null);
      try {
        const res = await fetch("/api/boundary", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          setSaveError(`Save failed (${res.status})`);
          return;
        }
        const data = (await res.json()) as {
          view: BoundaryView;
          findings: ScopeFinding[];
        };
        setView(data.view);
        setFindings(data.findings);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Network error");
      }
    });
  }

  function addFlow() {
    const next: ScopeFlow = {
      id: makeId(),
      direction: "inbound",
      channel: "email",
      description: "",
      counterparty: null,
      touches_scope_item_ids: [],
    };
    persist({ flows: [...view.flows, next] });
  }
  function updateFlow(id: string, patch: Partial<ScopeFlow>) {
    persist({
      flows: view.flows.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }
  function removeFlow(id: string) {
    persist({ flows: view.flows.filter((f) => f.id !== id) });
  }

  function addOos() {
    const next: OutOfScopeItem = {
      id: makeId(),
      asset: "",
      reason: "",
      segregation: "",
    };
    persist({ out_of_scope: [...view.out_of_scope, next] });
  }
  function updateOos(id: string, patch: Partial<OutOfScopeItem>) {
    persist({
      out_of_scope: view.out_of_scope.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    });
  }
  function removeOos(id: string) {
    persist({ out_of_scope: view.out_of_scope.filter((o) => o.id !== id) });
  }

  function updateAo(patch: Partial<AffirmingOfficial>) {
    persist({
      affirming_official: { ...ao, ...patch, acknowledged_at: null },
    });
  }
  function acknowledge() {
    startTransition(async () => {
      setSaveError(null);
      try {
        const res = await fetch("/api/boundary/acknowledge", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSaveError(body.message ?? `Acknowledge failed (${res.status})`);
          return;
        }
        // refresh view
        const refresh = await fetch("/api/boundary");
        if (refresh.ok) {
          const data = (await refresh.json()) as {
            view: BoundaryView;
            findings: ScopeFinding[];
          };
          setView(data.view);
          setFindings(data.findings);
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Network error");
      }
    });
  }

  const aoComplete =
    ao.name.trim().length > 0 &&
    ao.title.trim().length > 0 &&
    ao.email.trim().length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: live diagram + tables + validation */}
      <div className="min-w-0">
        <BoundaryDocument view={view} findings={findings} />
      </div>

      {/* Right rail: editor */}
      <aside className="space-y-5">
        <div className="border border-[#cfe3d9] bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-serif text-base font-bold">Save status</h3>
          <p className="text-xs text-[#456c5f]">
            {pending
              ? "Saving…"
              : saveError
                ? `Error: ${saveError}`
                : "All changes saved. Diagram re-rendered."}
          </p>
        </div>

        {/* Affirming Official */}
        <div className="border border-[#cfe3d9] bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-serif text-base font-bold">Affirming official</h3>
          <p className="mb-3 text-xs text-[#456c5f]">
            The named person who can attest to this boundary in SPRS. All three
            fields required.
          </p>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#10231d]">
            Name
          </label>
          <input
            value={ao.name}
            onChange={(e) => updateAo({ name: e.target.value })}
            placeholder="Jane Romero"
            className="mb-3 w-full border border-[#cfe3d9] px-3 py-2 text-sm"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#10231d]">
            Title
          </label>
          <input
            value={ao.title}
            onChange={(e) => updateAo({ title: e.target.value })}
            placeholder="Owner / President"
            className="mb-3 w-full border border-[#cfe3d9] px-3 py-2 text-sm"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#10231d]">
            Email
          </label>
          <input
            type="email"
            value={ao.email}
            onChange={(e) => updateAo({ email: e.target.value })}
            placeholder="jane@acmedef.com"
            className="mb-3 w-full border border-[#cfe3d9] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={acknowledge}
            disabled={!aoComplete || pending}
            className="w-full bg-[#0e2a23] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:bg-[#cfe3d9] disabled:text-[#7f9990]"
          >
            {ao.acknowledged_at
              ? `Acknowledged ${new Date(ao.acknowledged_at).toLocaleDateString()} — re-acknowledge`
              : "Acknowledge boundary"}
          </button>
        </div>

        {/* Flows */}
        <div className="border border-[#cfe3d9] bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-base font-bold">FCI data flows</h3>
            <button
              type="button"
              onClick={addFlow}
              className="border border-[#0e2a23] bg-[#0e2a23] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
            >
              + Add
            </button>
          </div>
          <p className="mb-3 text-xs text-[#456c5f]">
            How FCI enters, exits, and moves between systems. Document at least
            one inbound and one outbound channel.
          </p>
          {view.flows.length === 0 && (
            <p className="text-xs italic text-[#a06b1a]">No flows yet.</p>
          )}
          <div className="space-y-3">
            {view.flows.map((f) => (
              <div key={f.id} className="border border-[#e5efe9] bg-[#fbfdfc] p-3">
                <div className="mb-2 flex gap-2">
                  <select
                    value={f.direction}
                    onChange={(e) =>
                      updateFlow(f.id, {
                        direction: e.target.value as FlowDirection,
                      })
                    }
                    className="flex-1 border border-[#cfe3d9] px-2 py-1 text-xs"
                  >
                    {(["inbound", "outbound", "internal"] as const).map((d) => (
                      <option key={d} value={d}>
                        {flowDirectionLabels[d]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={f.channel}
                    onChange={(e) =>
                      updateFlow(f.id, {
                        channel: e.target.value as FlowChannel,
                      })
                    }
                    className="flex-1 border border-[#cfe3d9] px-2 py-1 text-xs"
                  >
                    {(Object.keys(flowChannelLabels) as FlowChannel[]).map(
                      (c) => (
                        <option key={c} value={c}>
                          {flowChannelLabels[c]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <textarea
                  value={f.description}
                  onChange={(e) =>
                    updateFlow(f.id, { description: e.target.value })
                  }
                  placeholder="Prime sends drawings via Exostar portal"
                  className="mb-2 w-full border border-[#cfe3d9] px-2 py-1 text-xs"
                  rows={2}
                />
                <input
                  value={f.counterparty ?? ""}
                  onChange={(e) =>
                    updateFlow(f.id, {
                      counterparty: e.target.value || null,
                    })
                  }
                  placeholder="Counterparty (Lockheed Martin RMS)"
                  className="mb-2 w-full border border-[#cfe3d9] px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeFlow(f.id)}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#b3261e] hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Out of scope */}
        <div className="border border-[#cfe3d9] bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-base font-bold">Out of scope</h3>
            <button
              type="button"
              onClick={addOos}
              className="border border-[#0e2a23] bg-[#0e2a23] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
            >
              + Add
            </button>
          </div>
          <p className="mb-3 text-xs text-[#456c5f]">
            Assets a reviewer might assume are in scope but aren&apos;t —
            marketing site, BYOD, accounting, etc. Each needs a reason and a
            segregation rationale.
          </p>
          {view.out_of_scope.length === 0 && (
            <p className="text-xs italic text-[#a06b1a]">Nothing declared yet.</p>
          )}
          <div className="space-y-3">
            {view.out_of_scope.map((o) => (
              <div key={o.id} className="border border-[#e5efe9] bg-[#fbfdfc] p-3">
                <input
                  value={o.asset}
                  onChange={(e) => updateOos(o.id, { asset: e.target.value })}
                  placeholder="Asset (e.g. acme-machining.com)"
                  className="mb-2 w-full border border-[#cfe3d9] px-2 py-1 text-xs"
                />
                <input
                  value={o.reason}
                  onChange={(e) => updateOos(o.id, { reason: e.target.value })}
                  placeholder="Why out of scope"
                  className="mb-2 w-full border border-[#cfe3d9] px-2 py-1 text-xs"
                />
                <input
                  value={o.segregation}
                  onChange={(e) =>
                    updateOos(o.id, { segregation: e.target.value })
                  }
                  placeholder="How segregated"
                  className="mb-2 w-full border border-[#cfe3d9] px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeOos(o.id)}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#b3261e] hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Narrative */}
        <div className="border border-[#cfe3d9] bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-serif text-base font-bold">Narrative (optional)</h3>
          <p className="mb-3 text-xs text-[#456c5f]">
            Free-text overview that appears below the diagram. Useful for
            context the diagram can&apos;t capture.
          </p>
          <textarea
            defaultValue={view.narrative ?? ""}
            onBlur={(e) => persist({ narrative: e.target.value || null })}
            rows={5}
            placeholder="e.g. We perform CNC machining for one DoD prime…"
            className="w-full border border-[#cfe3d9] px-2 py-2 text-xs"
          />
        </div>
      </aside>
    </div>
  );
}
