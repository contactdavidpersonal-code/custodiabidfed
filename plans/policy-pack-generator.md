# Per-client Policy Pack Generator

**Tagline:** Five signed, dated, business-named CMMC L1 policies — generated in 30 seconds, auditor-defensible, governed by Custodia.

**Positioning:** Most CMMC L1 SMBs have zero written policies. The CSV templates in `public/templates/` are tactical evidence forms; they are not governance documents. This workstream produces the **policy layer above the templates** — the actual signed instruments an assessor opens first.

**Scope discipline:** Five policies, one signature ceremony, one audit trail, one versioning model. No multi-tenant policy editor in v1. No custom clauses. No L2 controls.

---

## Guiding Principles

1. **Baseline-with-customization, not blank-page.** The platform owns the canonical clause library. Each client gets a personalized instance; they do not edit the legal substance, they ratify it. This is what protects them legally to CMMC L1 — the clauses come from a maintained, version-pinned, FAR 52.204-21–mapped corpus, not from a Word doc the founder wrote at 2am.
2. **Adoption is a ceremony, not an upload.** A policy is only effective once a designated officer of the company has signed it. The signature event is what an assessor will ask to see — the document text is secondary.
3. **Custodia is the system of record for governance.** Every policy version, every signature, every revocation is on Custodia. Clients can export PDFs at any time; the canonical instance lives here. Same model as `assessments` + `attestation-signature.ts`.
4. **Theme: Rhetorich-grade editorial weight.** Forest-green + cream, high-contrast serif headlines (Georgia/Playfair tier), generous margins, no clip-art. These documents are read by lawyers and contracting officers — they should look like instruments of governance.
5. **Five and only five.** AUP, ACP, MDP, Visitor SOP, IRP Quick Card. Not eight. Not three with "more coming". Pick five, ship five.

---

## Governance & Legal Protection Architecture

This is the part that protects the client legally and protects Custodia from "you generated bad policies and we got popped." Read this section before anything else.

### Three-layer model

| Layer | Owns | Versioned by | Signed by |
|---|---|---|---|
| **Clause Corpus** | Master clause text + control mappings + footnotes | Custodia engineering | n/a (governed by `pack_version`) |
| **Pack Version** | A pinned bundle of clauses with a `pack_version` (semver) and `effective_date` | Custodia engineering + counsel review | Custodia (HMAC over the canonical bundle) |
| **Client Instance** | One render of a Pack Version personalized to one organization | the client at adoption time | The client's designated **Affirming Official** |

Each generated PDF has a footer with three identifiers: `pack_version`, `instance_id`, `instance_signature_prefix`. An assessor scanning a PDF can verify:
- The clauses came from a Custodia-published corpus (recompute pack hash, compare).
- The instance was signed by the named officer at the named time (recompute instance HMAC).
- The instance has not been silently re-issued (instance_id is unique and immutable).

### What "protected to CMMC L1 standard" actually means here

CMMC L1 (FAR 52.204-21) does not require a specific policy format. The contracting officer / assessor wants to see, for each of the 15 requirements, *evidence the practice is in place*. A policy by itself is **not sufficient** — but a signed, dated, personalized policy is the strongest artifact-of-intent for the practices below, and is what every assessment guide explicitly asks for first.

Mapping (locked-in, do not change without counsel):

| Policy | FAR 52.204-21(b)(1) practices it directly evidences | Practices it supports indirectly |
|---|---|---|
| **Acceptable Use Policy (AUP)** | AC.L1-b.1.iv (control public information), SC.L1-b.1.xi (public posting controls) | AC.L1-b.1.i, AC.L1-b.1.ii (sets the rule users sign onto) |
| **Access Control Policy (ACP)** | AC.L1-b.1.i, AC.L1-b.1.ii, AC.L1-b.1.iii, IA.L1-b.1.v, IA.L1-b.1.vi | — |
| **Media Disposal SOP (MDS)** | MP.L1-b.1.vii | — |
| **Visitor Log SOP (VLS)** | PE.L1-b.1.viii, PE.L1-b.1.ix | — |
| **Incident Response Quick Card (IRC)** | SI.L1-b.1.xv | SI.L1-b.1.xii–.xiv (how to respond when AV/patch/monitoring flags something) |

Coverage check: this set of five plus the existing connector + manual evidence flows lights up **all 15** L1 requirements. SI.L1-b.1.xii–.xiv (malicious code / updates / monitoring) are technical-control evidenced through the connector/Defender/patch artifacts already shipped.

### Disclaimer & limitation language (locked-in)

Every generated pack ships with a fixed front-matter page titled **"About this policy pack"** containing:

1. *"This policy pack is issued by Custodia for use by `${legal_name}` ('the Company'). It is a baseline aligned to FAR 52.204-21(b)(1) and CMMC Level 1 self-assessment requirements (32 CFR § 170.15-.16). It is not legal advice. The Company is responsible for reading the policies, ratifying them via signature, and ensuring its actual operations conform."*
2. *"Custodia maintains the clause corpus version `${pack_version}`, effective `${effective_date}`. Clause provenance and control mappings are recorded in the appendix."*
3. *"Adoption of this pack does not by itself constitute compliance with CMMC Level 1; compliance requires implementation of the practices and submission of an SPRS self-assessment."*
4. A signature block for the Affirming Official to acknowledge points 1–3.

This is the piece that protects Custodia. The Company is on record acknowledging the baseline nature of the pack and their obligation to operationalize it.

### Affirming Official discipline

CMMC L1 self-attestation already requires an Affirming Official (32 CFR § 170.15(c)(2)). We reuse the same officer for policy adoption — the person whose name appears on `assessments.affirmed_by_name` is who must sign the policy pack. This is intentional:

- Single locus of accountability.
- One signature ceremony per cycle, not five.
- Identical legal posture to SPRS self-assessment.

If the assessment has not been started yet, policy generation gates on first nominating an Affirming Official (their name + title is captured in `organizations` extension, see schema below).

---

## Visual System — Rhetorich-styled Policy Documents

Reference: rhetorich.ai uses a **dark forest-green canvas + cream serif headlines + pale-mint accents + sans-serif body**. Custodia's existing `BOUNDARY_CSS` already lives in the same family (`--ink: #10231d`, `--green-bg: #f7fcf9`). The policy pack inherits and tightens it for editorial weight.

| Token | Value | Use |
|---|---|---|
| `--policy-ink` | `#10231d` | Body text, headlines |
| `--policy-paper` | `#fbfbf6` | Page background (warm off-white, prints clean) |
| `--policy-rule` | `#0e2a23` | Section dividers, page-bottom rule |
| `--policy-accent` | `#2f8f6d` | Eyebrow tags, control-ID chips |
| `--policy-cream` | `#e7efe9` | Cover page canvas (dark-mode cover with cream type) |
| Serif headline | `Georgia, "Times New Roman", serif` | All H1/H2 — same family already used by `BOUNDARY_CSS` |
| Sans body | `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | All body, lists, footers |

Rationale: Georgia at 28–32px on a forest-green or cream-on-green cover gives the rhetorich "instrument-of-governance" feel without bringing in a new webfont (zero CSP / fontconfig surface, no new dependencies). This matches the constraint already documented in the boundary render route.

**Document anatomy (every policy):**

1. **Cover page** — full-bleed forest-green panel, 64pt cream serif title, company legal name + UEI + CAGE + effective date in 12pt sans, single accent rule.
2. **About this pack** front matter (the locked disclaimer above) — first instance only, applies to all five.
3. **Policy body** — clauses in numbered sections, each clause stamped with a small `[AC.L1-b.1.i]` control-ID chip in the right margin so an assessor can read clause-to-control without flipping appendices.
4. **Roles & Responsibilities** — auto-personalized: Affirming Official name, Designated Compliance Officer (defaults to AO), MSP-of-record (if applicable).
5. **Signature page** — typed-name signature ceremony with HMAC stamp (see Adoption Ceremony below).
6. **Appendix A: Clause provenance** — every numbered clause linked to `pack_version` + clause hash + the FAR sub-paragraph it implements.
7. **Appendix B: Logs and forms referenced** — links each log mentioned in the body (visitor log, media disposal log, etc.) to the matching `public/templates/*.csv` shipped alongside.

**Footer (every page):**

```
{Company Name}  ·  {Policy short code}  ·  pack {pack_version}  ·  instance {instance_id_short}  ·  page {n} of {total}
```

The `instance_id_short` is the first 12 chars of the SHA-256 of the canonical signed instance — the same defensibility model as connector `data_hash`.

---

## What the Five Policies Contain (clause-level skeleton)

Locked-in clause architecture. Counsel review required before first ship. Implementation lives in `src/lib/policies/clauses/<policy>.ts` returning typed clause objects.

### 1. Acceptable Use Policy (AUP) — short code `AUP`

1.1 Purpose & scope (whose conduct is governed)
1.2 Definitions (FCI, in-scope system, public-facing system) — pulled verbatim from FAR 52.204-21(a)
1.3 Authorized use — what users may do
1.4 Prohibited use — explicit list (no posting FCI to public sites, no use of unauthorized external systems, no shadow IT, BYOD rules)
1.5 Public posting review (gates AC.L1-b.1.iv) — references `public-posting-acknowledgement.csv`
1.6 External system use (gates AC.L1-b.1.iii) — references `external-systems-inventory.csv`
1.7 Enforcement & disciplinary action
1.8 User acknowledgement signature block (per-user, separate ceremony from policy adoption)

### 2. Access Control Policy (ACP) — short code `ACP`

2.1 Purpose & scope
2.2 Account lifecycle — creation, modification, disablement, deletion (gates AC.L1-b.1.i, IA.L1-b.1.v)
2.3 Least-privilege principle (gates AC.L1-b.1.ii) — references `role-matrix.csv`
2.4 Authentication requirements (gates IA.L1-b.1.vi) — MFA mandate, password rule references
2.5 External connections (gates AC.L1-b.1.iii) — what may connect, who approves
2.6 Periodic review cadence — quarterly access review, references `authorized-users-roster.csv`
2.7 Roles & Responsibilities (personalized: AO, IT lead/MSP, individual users)

### 3. Media Disposal SOP (MDS) — short code `MDS`

3.1 Purpose & scope (in-scope media types: drives, paper, removable media)
3.2 Sanitization methods — by media type (NIST SP 800-88 references; cryptographic erase, physical destruction, shredding)
3.3 Chain of custody — who collects, who witnesses, who logs
3.4 Logging requirement (gates MP.L1-b.1.vii) — references `media-disposal-log.csv`
3.5 Retention of disposal records (3 years minimum)
3.6 Roles & Responsibilities

### 4. Visitor Log SOP (VLS) — short code `VLS`

4.1 Purpose & scope (in-scope physical spaces)
4.2 Visitor categories — escorted vs. authorized
4.3 Sign-in / sign-out procedure (gates PE.L1-b.1.viii, PE.L1-b.1.ix) — references `visitor-log.csv`
4.4 Escort requirements
4.5 Audit log retention
4.6 Roles & Responsibilities (front-desk owner, escort owner)

### 5. Incident Response Quick Card (IRC) — short code `IRC`

CMMC L1 only requires a documented response *plan* (SI.L1-b.1.xv). Not full L2 IR maturity. The Quick Card is intentionally a **two-page printable** that lives by the front desk and on the laptop sticker.

5.1 What is an incident (FCI exposure, malware, lost device, unauthorized access)
5.2 First-response checklist (5 numbered steps, big type)
5.3 Notification chain — personalized phone tree (AO → IT lead/MSP → Prime contractor PoC if FCI)
5.4 Containment quick guide (disconnect, don't power off, preserve)
5.5 Reporting obligations (DC3/DCISE if DFARS 252.204-7012 also applies; not required for L1 but flagged if `naics_codes` overlaps DoD)
5.6 Post-incident review (timeline + lessons learned, kept by AO)

---

## Personalization Sources (deterministic — no LLM in v1)

All substitutions come from existing typed sources. No model calls in the generation path; the output must be reproducible to satisfy the provenance hash.

| Token | Source |
|---|---|
| `{legal_name}` | `organizations.name` |
| `{cage_code}` | `organizations.cage_code` (omit row if null) |
| `{sam_uei}` | `organizations.sam_uei` (omit if null) |
| `{naics_list}` | `organizations.naics_codes` (joined ", ") |
| `{ao_name}`, `{ao_title}` | New `organizations.affirming_official_name` / `affirming_official_title` (see schema) |
| `{compliance_officer_name}` | New `organizations.compliance_officer_name`, defaults to AO if null |
| `{msp_name}` | If `clerk_org_id IS NOT NULL`, look up the parent MSP org name; else null (omit MSP-of-record line) |
| `{in_scope_systems_summary}` | Derived from `scope_profile` (the FCI Boundary already shipped) — `flows[].asset` deduplicated, max 8 |
| `{out_of_scope_systems_summary}` | `scope_profile.out_of_scope[].asset` deduplicated |
| `{physical_locations}` | `business_profile.data.physical_locations` if present, else literal "the Company's primary place of business" |
| `{primary_email}` | `business_profile.data.bid_ready.poc_email` if present, else `auth.user.primaryEmailAddress` |
| `{effective_date}` | `signed_at` of the adoption ceremony |
| `{pack_version}` | The clause-corpus version pinned at generation time |
| `{instance_id_short}` | First 12 chars of `sha256(canonical_instance_json)` |

LLM usage is **forbidden** in the generator path. The clauses are static. Personalization is string templating only. This is a hard constraint to keep `pack_version` + clause hashes meaningful.

---

## Data Model

### New table: `policy_packs`

One row per (organization, pack_version, instance) — the canonical signed instance. Source of truth.

```sql
CREATE TABLE policy_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pack_version TEXT NOT NULL,                        -- e.g. "2026.05.0"
  effective_date DATE NOT NULL,                      -- when the pack became effective for this org
  superseded_at TIMESTAMPTZ,                         -- non-null when a new instance supersedes
  superseded_by UUID REFERENCES policy_packs(id) ON DELETE SET NULL,

  -- Personalization snapshot (frozen at generation time)
  legal_name TEXT NOT NULL,
  cage_code TEXT,
  sam_uei TEXT,
  ao_name TEXT NOT NULL,
  ao_title TEXT NOT NULL,
  compliance_officer_name TEXT,
  msp_name TEXT,
  scope_summary JSONB NOT NULL,                      -- frozen snapshot of scope_profile

  -- Adoption ceremony
  signed_by_user_id TEXT NOT NULL,                   -- Clerk user id of the signer
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_hex TEXT NOT NULL,                       -- HMAC-SHA256 over canonical_json
  signature_key_version TEXT NOT NULL,               -- ATTESTATION_SIGNING_KEY version
  payload_sha256_hex TEXT NOT NULL,                  -- sha256(canonical_json)
  canonical_json JSONB NOT NULL,                     -- the full instance payload

  -- Render artifacts (one PDF/HTML per policy in the pack)
  artifacts JSONB NOT NULL,                          -- [{policy_short_code, blob_url, sha256, size_bytes}]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (pack_version ~ '^[0-9]{4}\.[0-9]{2}\.[0-9]+$')
);

CREATE INDEX idx_policy_packs_org_active ON policy_packs (organization_id, signed_at DESC)
  WHERE superseded_at IS NULL;
```

The pack is **immutable once signed**. To revise: generate a new instance, set the old row's `superseded_at` and `superseded_by`. An assessor can always trace the lineage.

### New columns: `organizations`

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS affirming_official_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS affirming_official_title TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS compliance_officer_name TEXT;
```

These are the long-lived AO and CO declarations. The values are copied (not referenced) into `policy_packs.ao_name`/`ao_title`/`compliance_officer_name` at signing time so the pack instance is self-contained even if the org later changes its officer.

### Auto-mapping into existing evidence pipeline

Generated artifacts are **also written into** `evidence_artifacts` + `evidence_artifact_practices` so the existing assessment UI (per-control evidence list) shows the policy automatically. Reuses the connector auto-map work shipped in commit `f35ea67`. Provenance:

```
source_provider = "policy_pack"
source_kind     = one of: "policy.aup" | "policy.acp" | "policy.mds" | "policy.vls" | "policy.irc"
data_hash       = sha256 of the rendered PDF bytes
synced_at       = signed_at
```

Each policy short code maps to its practice set (the table at the top of "Governance"). The `evidence_artifact_practices` rows are inserted with the right `objectives` arrays. This means: **adopting the policy pack lights up policy-evidence rows on every relevant control without a single click.**

### New `AuditAction` values (`src/lib/security/audit-log.ts`)

```typescript
"policy_pack.generated"   // metadata: {pack_version, ao_name}
"policy_pack.signed"      // metadata: {pack_id, payload_sha256_hex}
"policy_pack.exported"    // metadata: {pack_id, format: "zip"|"pdf"|"html"}
"policy_pack.superseded"  // metadata: {old_pack_id, new_pack_id}
"policy_pack.officer_designated"  // metadata: {ao_name, ao_title}
```

---

## Adoption Ceremony — the signing flow

Reuses `src/lib/security/attestation-signature.ts` directly. Same key, same canonicalization, same audit posture as SPRS attestation. This matters: assessors who have already inspected one Custodia signature understand all of them.

Flow:

1. `/policy-pack/preview` — server route, renders all five policies as a single scrollable HTML preview using current org data. **Not signed.** Watermarked "DRAFT — UNSIGNED" diagonally across every page. Allows the AO to read the substance before committing.
2. `/policy-pack/adopt` — gated route, requires:
   - Active org has an Affirming Official set (`organizations.affirming_official_name` not null)
   - Active org has a populated `scope_profile` (so the personalized scope summary isn't empty)
   - Signing user is the Clerk user with org admin role (or sole owner)
3. The adopt form shows the three locked disclaimer points and a single "I, `${ao_name}`, `${ao_title}`, on behalf of `${legal_name}`, hereby adopt this policy pack effective today" checkbox + a typed-name confirmation field that must equal `${ao_name}` (constant-time compared).
4. On submit:
   - Assemble canonical JSON (clauses + personalization + AO declaration)
   - HMAC-SHA256 with `ATTESTATION_SIGNING_KEY` → `signature_hex`
   - Render five PDFs (or print-ready HTML; see "Rendering pipeline" below)
   - Upload each to Vercel Blob, encrypted with per-tenant DEK (same path as evidence_artifacts)
   - Insert `policy_packs` row
   - Insert five `evidence_artifacts` + `evidence_artifact_practices` rows (auto-mapping)
   - Mark previous active pack `superseded_at = NOW(), superseded_by = new_id`
   - `recordAuditEvent({action: "policy_pack.signed", ...})`
   - Redirect to `/policy-pack/[id]` confirmation page with download links

**No DocuSign, no e-sign vendor.** A typed-name + HMAC-stamped instance is the same legal posture as `assessments.affirmed_by_name`. If/when a customer demands DocuSign integration, that's a v2 feature behind a feature flag.

---

## Rendering Pipeline — how PDFs actually get made

**Constraint:** `package.json` currently has no PDF library. Adding `@react-pdf/renderer` is a 2 MB+ dependency with its own font + layout stack. Adding `puppeteer` is a no-go on Vercel functions (cold-start + binary size). The existing pattern (`/api/boundary/render`) emits self-contained HTML using `react-dom/server.edge` and instructs the user to print-to-PDF.

**v1 decision: HTML-first, print-to-PDF later.**

Each policy renders as standalone HTML matching the visual system. Same approach as boundary render route. The output is:

- **Web preview**: `/policy-pack/[id]/[short_code]` — read in the app, can be printed to PDF by browser
- **Standalone HTML download**: `/api/policy-pack/[id]/render/[short_code]` — single-file `.html` with inline CSS, ready to email or attach to a bid packet
- **Bundle download**: `/api/policy-pack/[id]/zip` — JSZip bundle of all five HTML files + the front matter + the matching CSV templates from `public/templates/`

This is identical infrastructure to the bid-package zip already shipped at [src/app/api/assessments/[id]/bid-package/route.ts](src/app/api/assessments/[id]/bid-package/route.ts).

**v1.1 (fast follow, not blocking):** add a `/api/policy-pack/[id]/render/[short_code].pdf` endpoint that uses `@react-pdf/renderer` once we audit the bundle size. Defer until users ask.

The `data_hash` recorded for tamper-detection is computed on the **HTML bytes** in v1, recomputed on PDF bytes if/when v1.1 ships. Both forms carry the same `instance_id` in their footer so they're verifiably the same instance.

---

## Files to Build

```
src/lib/policies/
  pack-version.ts            # PACK_VERSION + EFFECTIVE_DATE constants
  types.ts                   # Clause, PolicyDocument, PolicyPackInstance types
  clauses/aup.ts             # Acceptable Use clause set
  clauses/acp.ts             # Access Control clause set
  clauses/mds.ts             # Media Disposal SOP clause set
  clauses/vls.ts             # Visitor Log SOP clause set
  clauses/irc.ts             # Incident Response Quick Card clause set
  generate.ts                # personalize(clauses, org) -> PolicyDocument[]
  canonical.ts               # canonicalJson(instance), sha256, HMAC sign/verify
  store.ts                   # createPolicyPack, getActivePack, supersedePack

src/components/policy-pack/
  PolicyPage.tsx             # the rhetorich-styled HTML shell (cover + body + footer)
  ClauseRenderer.tsx         # numbered clause with control-ID chip
  SignaturePage.tsx
  styles.ts                  # POLICY_CSS — exported the same way BOUNDARY_CSS is

src/app/policy-pack/
  page.tsx                   # landing: status + adopt button + history
  preview/page.tsx           # unsigned watermarked preview
  adopt/page.tsx             # signing ceremony form
  adopt/actions.ts           # server action: assemble + sign + persist
  [id]/page.tsx              # signed instance landing (download links)
  [id]/[short_code]/page.tsx # in-app readable view of one policy

src/app/api/policy-pack/
  [id]/render/[short_code]/route.ts   # standalone HTML download
  [id]/zip/route.ts                   # JSZip bundle

src/lib/db.ts
  # ALTER organizations + CREATE TABLE policy_packs

src/lib/security/audit-log.ts
  # add 5 new AuditAction values

src/app/assessments/layout.tsx
  # add "Policies" nav link between Boundary and Tickets
```

**Estimate:** medium. The clause text is the long pole — counsel must review every clause before first publish. Engineering itself is a 2-day task on top of the existing scaffolding (boundary render, bid-package zip, attestation signature, evidence auto-map).

---

## Eng-review Rules (locked-in)

1. **No LLM in the generation path.** Personalization is deterministic string substitution from typed sources. Anything else breaks the provenance hash and the audit story.
2. **Clauses are TypeScript modules, not Markdown files.** This forces compile-time validation that every clause has its `controlMappings` array populated. A clause with no mapping fails to compile.
3. **`pack_version` is bumped on every clause change.** Format `YYYY.MM.N`. Bump is enforced by a build-time script that hashes the clause corpus and refuses to build if the hash changed without a version bump.
4. **The five PDFs in a pack share one `instance_id`.** They are facets of one signed instance, not five separate documents. Tampering with one invalidates the whole pack.
5. **Reuse `signAttestation()` from `attestation-signature.ts`.** Do not invent a second signing path. Same key, same canonicalization rules, same audit verbs.
6. **Auto-map into `evidence_artifacts` + `evidence_artifact_practices`.** Same shape as connector auto-map (commit f35ea67). The policy pack is just another evidence source with `source_provider = "policy_pack"`.
7. **Watermark unsigned previews.** "DRAFT — UNSIGNED — NOT EFFECTIVE" diagonally across every page in 14% opacity red, full-bleed. Users will try to email the preview as if it were signed; the watermark stops that conversation.
8. **No edit-the-clause UI in v1.** Customers can request clause changes via support; we publish a new `pack_version` if approved. Self-serve clause editing breaks the legal-protection story.

---

## Open Questions / RFDs

| Question | Status |
|---|---|
| Does counsel sign off on the five clause-set drafts before first ship? | **PENDING COUNSEL** — blocking |
| Do we need a per-user AUP acknowledgement table (separate from the adoption signature)? | **PENDING** — likely yes for v1.1; an AUP is more credible when employees have individually signed it |
| Should we offer Spanish-language packs? | **DEFERRED** — out of scope for v1 |
| Do MSPs sign on behalf of multiple clients in one ceremony? | **PENDING** — recommend no in v1; one ceremony per client because the AO must be the client's officer, not the MSP's |
| Is `react-pdf/renderer` worth adding for v1.1? | **PENDING** — measure cold-start impact first |
| Do we sell the policy pack as a standalone SKU or bundle into existing tiers? | **PENDING CEO** — recommend bundle (it's the wedge that closes solo-tier deals) |

---

## Out of Scope (v1)

- Custom clause editor / WYSIWYG
- Per-user AUP acknowledgement tracking (move to v1.1 if asked)
- L2 policy set (System Security Plan templates, Configuration Management Policy, Maintenance Policy, etc.)
- DocuSign / Adobe Sign integration
- Multi-language renders
- Policy training quiz / acknowledgement flows
- Auto-generated System Security Plan from the pack — separate workstream
- E-mail delivery of signed pack to AO (download-only in v1)

---

## Key Dependencies

- **Counsel review of all five clause drafts** before first `pack_version` is published. This is the long pole.
- The boundary `scope_profile` shipped (already done — commit `b29746a`).
- Connector evidence auto-map (already done — commit `f35ea67`) — used as the reference pattern for `evidence_artifact_practices` insertion.
- `attestation-signature.ts` and `ATTESTATION_SIGNING_KEY` env var (already in production).
