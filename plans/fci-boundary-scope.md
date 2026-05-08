# FCI Boundary & Scope Profile — auto-generated boundary diagram

**Status:** Draft for review
**Owner:** Eng + Compliance
**Reference preview:** [public/boundary-diagram-preview.html](../public/boundary-diagram-preview.html)

## Why

Today the platform captures a freeform `scoped_systems` paragraph on each
`organizations` row. That string drives the SSP narrative but produces no
visual artifact and runs no validation. A reviewer (prime security officer,
DCMA, or our own backstop CO) reading an L1 SSP wants to see, on page two,
**a one-page concentric boundary diagram** with explicit FCI Boundary,
Assessment Boundary, External Service Providers, out-of-scope items, and
data flows — every element traceable to a system of record.

This plan replaces the freeform scope paragraph with a typed
`scope_profile` JSON object, drives an SVG boundary diagram and inventory
tables off that object, runs validation rules before SSP generation, and
embeds the rendered HTML/PDF as SSP § 1.2 in the bid-ready ZIP. **The
client never opens a drawing tool.**

## Non-goals

- Network topology / Visio replacement. We render an *information* boundary,
  not a network diagram.
- L2 scoping. Scope object is L1-shaped only; CUI Asset categories are out
  of scope for this plan.
- Manual canvas editing. Every visual element comes from typed data.

## What success looks like

1. After Charlie's onboarding interview, the client sees a populated
   boundary diagram before they ever touch a control.
2. The MSP can attach the diagram (HTML + PDF) to a prime questionnaire
   and to the bid-ready ZIP without touching it.
3. Validation rules block SSP generation on hard failures and surface
   warnings to the affirming official for explicit acknowledgement.
4. Edits in the intake re-render the diagram on save (no rebuild step).

---

## Data model

### New column: `organizations.scope_profile jsonb`

Keep `scoped_systems text` for backward compatibility; new code reads
`scope_profile`, falls back to `scoped_systems` for orgs that haven't
re-onboarded yet.

### TypeScript shape (`src/lib/cmmc/scope.ts` — new file)

```ts
export type ScopeProfile = {
  version: 1;
  generated_at: string;             // ISO; bumped on every save
  legal_entity: {
    name: string;                   // mirrored from organizations.name
    cage: string | null;            // mirrored from organizations.cage_code
    uei:  string | null;
    naics: string[];
  };
  affirming_official: {
    name: string;
    title: string;
    email: string;
    acknowledged_at: string | null; // signed acknowledgement timestamp
  } | null;
  people: ScopePerson[];            // who handles FCI
  endpoints: ScopeEndpoint[];       // workstations / laptops / shared devices
  storage: ScopeStorage[];          // SharePoint, Drive, on-prem share, mailbox, etc.
  flows: ScopeFlow[];               // inbound / outbound / internal
  esps: ScopeEsp[];                 // external service providers (in-scope)
  out_of_scope: ScopeOutOfScope[];  // explicitly excluded
  diagram_overrides?: {
    palette?: "default" | "print";  // future: high-contrast / B&W for paper
  };
};

export type ScopePerson = {
  id: string;                       // stable uuid
  display_name: string;
  role: string;
  source: ScopeSource;              // where we got this row
};

export type ScopeEndpoint = {
  id: string;
  hostname: string;
  os: string;                       // "Win 11 Pro", "macOS 14", etc.
  controls: string[];               // ["BitLocker", "Defender", "Intune-enrolled"]
  source: ScopeSource;
};

export type ScopeStorage = {
  id: string;
  kind: "sharepoint" | "onedrive" | "google_drive" | "mailbox"
      | "on_prem_share" | "removable_media" | "paper" | "other";
  label: string;                    // "DoD-Contracts site", "dod@acmedef.com"
  access_control: string;           // one-line description
  source: ScopeSource;
};

export type ScopeFlow = {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  description: string;              // "Prime sends drawings via Exostar"
  channel: string;                  // "Exostar portal", "email", "SFTP", "USB"
  endpoints_touched: string[];      // ScopeEndpoint.id[] (optional)
  storage_touched:  string[];       // ScopeStorage.id[]  (optional)
};

export type ScopeEsp = {
  id: string;
  name: string;                     // "Microsoft 365 Business Premium"
  role: string;                     // one-line description
  flow_down_on_file: boolean;       // FAR 52.204-21 acknowledged?
  notes?: string;                   // "FedRAMP Moderate (Commercial). US tenant."
};

export type ScopeOutOfScope = {
  id: string;
  asset: string;
  reason: string;                   // why it's out
  segregation: string;              // how it's kept out
};

export type ScopeSource =
  | { kind: "connector"; provider: "m365" | "google" | "intune"
              | "entra" | "exchange" | "sharepoint";
      pulled_at: string;            // ISO
      ref?: string }                // group id, site id, etc.
  | { kind: "declared"; declared_by: string; declared_at: string }
  | { kind: "msa"; party: string }
  | { kind: "contract"; party: string }
  | { kind: "policy"; policy_id: string };
```

### Migration

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS scope_profile jsonb;

-- For orgs that already have scoped_systems text, leave scope_profile NULL.
-- Rendering code falls back to a simple "single bucket" diagram + a banner
-- prompting the client to re-run the boundary intake.
```

No backfill job. Diagram quality is opt-in per client; on next onboarding
edit, Charlie writes the structured object.

---

## Intake flow (Charlie)

`src/app/onboard/OnboardingChat.tsx` already runs a chat-style interview.
Add a dedicated **Boundary section** with six structured prompts. Each
answer is committed to `scope_profile` immediately; the diagram preview
re-renders inline.

### The six questions

1. **Who handles FCI?**
   Multi-select from connector-pulled directory ("FCI-Users" Entra group
   if it exists; raw user list otherwise) + free-add. Output → `people[]`.

2. **Where does FCI live at rest?**
   Pick from connector-discovered storage (SharePoint sites, Drive shared
   drives, mailboxes) + free-add ("on-prem file server", "paper folder in
   locked cabinet"). Output → `storage[]`.

3. **Where does FCI come in from?**
   Multi-pick: prime portal (named), email, SFTP, USB from prime, paper.
   Output → `flows[]` with `direction: "inbound"`.

4. **Where does FCI go out to?**
   Same channels. Output → `flows[]` with `direction: "outbound"`.

5. **What endpoints can touch the storage above?**
   Pull from Intune / Jamf / Workspace ChromeOS device list; client checks
   the boxes. Output → `endpoints[]`.

6. **What's explicitly out of scope?**
   Required free-add list with `reason` + `segregation` per row. Charlie
   pre-suggests the common ones (marketing site, accounting, BYOD, shop-floor
   machines) based on industry / NAICS — client confirms or removes.

ESPs are auto-populated from connector identity (M365 = ESP, Google
Workspace = ESP, the MSP itself = ESP via the org's "managing MSP"
relationship, Custodia BidFed = ESP) plus any user-declared portals
(Exostar, Procurement Integrated Enterprise Environment, etc.).

### Affirming-official capture

A separate one-time prompt captures `affirming_official` and, on save,
stores the signed acknowledgement (name, title, IP, timestamp) in
`audit_log`. Used on every artifact downstream (no re-asking).

---

## Rendering

### File layout

```
src/lib/cmmc/scope.ts                  # types + zod schema + validators
src/lib/cmmc/scope-defaults.ts         # NAICS-based out-of-scope suggestions
src/components/boundary/                # new
  BoundaryDiagram.tsx                  # React/SVG render of the diagram
  BoundaryInventory.tsx                # inventory table
  BoundaryValidation.tsx               # pass/warn/fail panel
  index.ts
src/app/api/boundary/render/route.ts   # GET: returns rendered HTML for export
```

### `BoundaryDiagram.tsx`

- Pure function of `ScopeProfile`. No data fetching, no `use client`-only
  side effects beyond layout.
- Renders an SVG with three concentric zones (External / Assessment /
  FCI), an ESP column, and a data-flows panel — visually identical to
  [public/boundary-diagram-preview.html](../public/boundary-diagram-preview.html).
- Layout is **deterministic from the data**, not free-positioned:
  - `people[]`, `endpoints[]`, `storage[]`, `flows[]` each get a fixed
    box; box height auto-grows up to a cap, then paginates the overflow
    rows into a follow-on "Inventory continued" table below the diagram.
  - ESP column sized to fit up to 6 ESPs on the main page; rest spill to
    the inventory table.
- Accessible: `role="img"` + `aria-label` summarising scope, plus an
  off-screen `<desc>` enumerating every box for screen readers and the
  PDF tagger.

### `BoundaryInventory.tsx`

- Renders the four tables from the preview HTML directly off the typed
  arrays:
  - In-FCI (people + endpoints + storage)
  - ESPs
  - Out-of-Scope
  - Source-of-truth stamps column on every row, derived from
    `ScopeSource`.

### `BoundaryValidation.tsx`

Runs the rules from `validateScope()` (below) and renders pass/warn/fail
rows matching the preview. Pass-only state shows a green "Ready for SSP"
footer; any FAIL row blocks the "Generate SSP" button upstream.

---

## Validation rules

Pure function in `src/lib/cmmc/scope.ts`:

```ts
export type ScopeFinding = {
  level: "pass" | "warn" | "fail";
  code: string;                  // stable code for telemetry
  message: string;
  control_refs?: string[];       // ["AC.L1-3.1.1", ...]
};

export function validateScope(p: ScopeProfile): ScopeFinding[];
```

### Rules (initial set — extend over time)

| Code            | Level | Trigger                                                  | Refs                                  |
| --------------- | ----- | -------------------------------------------------------- | ------------------------------------- |
| `PEOPLE_EMPTY`  | fail  | `people.length === 0`                                    | AC.L1-3.1.1, IA.L1-3.5.1              |
| `STORAGE_EMPTY` | fail  | `storage.length === 0`                                   | AC.L1-3.1.1, MP.L1-3.8.3              |
| `ESP_M365_MSP_MISSING` | fail | M365 connector active but no ESP entry for it OR no managing-MSP ESP entry | AC.L1-3.1.20 |
| `OOS_EMPTY`     | warn  | `out_of_scope.length === 0`                              | scoping guidance                      |
| `INBOUND_NO_SYSTEM` | fail | inbound flow exists but no `storage` or `endpoints` covers receipt | AC.L1-3.1.1, SC.L1-3.13.1 |
| `OUTBOUND_NO_SYSTEM` | fail | outbound flow exists but no in-scope system carries it | SC.L1-3.13.1                          |
| `REMOVABLE_MEDIA_NO_MP` | warn | any flow uses `USB`/removable + no media-sanitization SOP linked | MP.L1-3.8.3 |
| `ENDPOINT_NO_AV` | warn  | endpoint with no `Defender`/`AV` listed in `controls`    | SI.L1-3.14.2..5                       |
| `STORAGE_PUBLIC_SHARING` | fail | sharepoint/google_drive storage with `access_control` containing public-sharing markers from connector pull | AC.L1-3.1.20, AC.L1-3.1.22 |
| `ESP_FLOWDOWN_MISSING` | fail | any ESP with `flow_down_on_file: false` | AC.L1-3.1.20             |
| `AO_NOT_ACK`    | fail  | `affirming_official.acknowledged_at == null`             | (gates SPRS draft)                    |
| `STALE_CONNECTOR_PULL` | warn | latest connector pull > 30 days old                  | freshness                             |

`fail` blocks `generateSsp()`. `warn` requires explicit affirming-official
ack (one click; recorded with timestamp + IP).

---

## API surface

### `GET /api/boundary?orgId=...` (existing org-scoped auth)

Returns `{ profile: ScopeProfile, findings: ScopeFinding[] }`. Used by
the workspace UI to render the live preview.

### `PATCH /api/boundary`

Body: partial `ScopeProfile`. Server merges, re-runs `validateScope`,
persists, returns the new profile + findings. All writes append to
`audit_log` keyed by `organization_id` + `actor_user_id`.

### `GET /api/boundary/render?orgId=...&format=html|pdf`

Server-side render to:
- `html` — single-file standalone HTML (inlined CSS, the preview
  template), ready to attach or print
- `pdf` — same HTML run through Chromium headless (Vercel's
  `@vercel/og`-style runtime is too restrictive; use a serverless
  Chromium endpoint or queue a render job — see "Open questions")

The HTML output is the same template as
[public/boundary-diagram-preview.html](../public/boundary-diagram-preview.html)
with values substituted. We keep the preview file as the canonical
template — any styling change updates both.

### Bid-ready ZIP integration

The packet generator already assembles SSP + affirmation + evidence
inventory. Add the rendered boundary HTML/PDF as **§ 1.2** of the SSP
and as a top-level `boundary.pdf` file in the ZIP root for primes who
just want the diagram.

---

## SSP narrative integration

`generateSsp()` currently composes narratives from the freeform
`scoped_systems` paragraph. Update each control's narrative template to
read structured fields:

- `AC.L1-3.1.1` — enumerates `people[]` and the storage-level access
  controls from `storage[].access_control`.
- `AC.L1-3.1.20` — enumerates `esps[]` and inbound/outbound `flows[]`.
- `AC.L1-3.1.22` — explicitly references `out_of_scope[]` items tagged
  as public (e.g., marketing site).
- `SC.L1-3.13.1` — enumerates inbound/outbound `flows[]` and the
  boundary system carrying each (M365 mailbox, Exostar, etc.).
- `MP.L1-3.8.3` — references any `flows[]` with `channel: "USB"` /
  removable + the media-sanitization SOP linked in policy pack.

This is not a new generator; it's targeted edits to the existing
templates, hidden behind a feature flag (`scope_profile_v1`) until a few
real clients have validated their diagrams.

---

## UX placement

A new workspace page `src/app/assessments/boundary/page.tsx`:

1. **Top** — live boundary preview (the rendered diagram + inventory).
2. **Right rail** — the six intake prompts in a stepper, each editable
   inline; saving any field re-runs validation and re-renders the
   preview without a navigation.
3. **Bottom** — the validation panel (pass/warn/fail).
4. **Action** — "Download HTML" / "Download PDF" / "Attach to packet"
   buttons. The "Generate SSP" CTA elsewhere in the workspace pulls
   directly from this profile.

Marketing/landing surfaces stay untouched until the feature ships.

---

## Phased delivery

### Phase 1 — typed model + intake (1 week)

- Migration: `scope_profile jsonb` column.
- `src/lib/cmmc/scope.ts` with types, zod schema, `validateScope`.
- Charlie boundary section (6 prompts), saves to `scope_profile`.
- New page `src/app/assessments/boundary/page.tsx` with simple JSON
  editor (no rendering yet) + validation panel.

### Phase 2 — diagram render (1 week)

- `BoundaryDiagram.tsx` SVG component, deterministic layout.
- `BoundaryInventory.tsx` tables with source-of-truth stamps.
- Live preview wired into the boundary page.
- Static HTML export at `/api/boundary/render?format=html`.

### Phase 3 — validation hard gates + bid packet (1 week)

- Connect `validateScope` to the existing `generateSsp()` gate.
- Affirming-official acknowledge flow + audit-log entry.
- Bid-ready ZIP includes `boundary.pdf` and SSP § 1.2.
- Feature flag `scope_profile_v1` flips on for the first three pilot
  orgs.

### Phase 4 — connector auto-population (after pilot feedback)

- M365/Entra: pull "FCI-Users" group → `people[]`.
- Intune: pull device list → `endpoints[]`.
- SharePoint audit: enumerate restricted sites → `storage[]`.
- Each push goes to a "suggested edits" tray, not auto-overwrite. Client
  confirms; pull becomes the new `ScopeSource` on each row.

---

## Risks & open questions

1. **PDF rendering surface.** Vercel's edge runtime won't host headless
   Chromium. Options: (a) `@react-pdf/renderer` for a PDF-native
   re-implementation of the diagram, (b) a queue + Render-style worker
   that runs Chromium, (c) ship HTML-only first and add PDF in a follow-up.
   Recommend (c) for Phase 2, (a) for Phase 3 if PDF is a blocker for
   primes.
2. **L1 vs scoping-guide alignment.** The L1 scoping guide treats every
   in-scope asset uniformly; we deliberately call out ESP separately
   because that's what reviewers ask about. We are *more* defensive
   than the floor — that's a feature, not a deviation. Flag to backstop
   CO for confirmation before pilot.
3. **What about clients with no IT?** ~10% of L1 SMBs have no M365 / no
   Google. Diagram still works: the FCI Boundary box becomes "Paper
   files locked in cabinet, owner-issued laptop" and ESPs reduce to
   "Custodia BidFed + the MSP." Validation rules already handle empty
   connector pulls (no `STALE_CONNECTOR_PULL` if there's nothing to be
   stale).
4. **Diagram editing.** Phase 1 ships with the JSON editor (power-user
   path) + the chat prompts (default path). No drag-to-reposition
   canvas; if a real customer asks, we revisit.
5. **Localization.** L1 is US-only; the artifact is English-only by
   design. Skip i18n.

---

## Definition of done

- `scope_profile` written for at least 3 pilot client orgs.
- Each pilot org has downloaded the rendered HTML + PDF and approved it.
- A backstop CO has reviewed all 3 packages against FAR 52.204-21 and
  the CMMC L1 scoping guide and signed off.
- The bid-ready ZIP for at least one of those clients has been delivered
  to a real prime, and the prime accepted it without scope-related
  pushback.
- Validation findings panel shows zero `fail` rows and only
  acknowledged `warn` rows on all 3 pilot packages.
