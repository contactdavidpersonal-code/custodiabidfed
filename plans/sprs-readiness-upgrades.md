# SPRS Readiness Upgrades — CMMC Level 1 A-to-Z

**Source of truth:** SPRS CMMC Quick Entry Guide v4.0 (DEC 2024), SPRS
Vendor Cyber Reports Access v4.0 (DEC 2024), **CMMC Assessment Guide –
Level 1 v2.13 (SEP 2024)**, **CMMC Scoping Guide – Level 1 v2.13 (SEP
2024)**, 32 CFR §§ 170.15 / 170.19 / 170.24, FAR 52.204-21, DFARS
252.204-7021. Extracted text in `.tmp/sprs-research/`.

**Goal:** A user who finishes Custodia can post a correct **Final Level 1
Self-Assessment** in SPRS without a single misstep, and Custodia has the
artifacts to prove it.

---

## P0 — Correctness blockers (fix before anything else)

> **Status:** All six P0 items SHIPPED. Implementation notes are inline
> under each item. The platform now matches the SPRS Quick Entry Guide
> v4.0 reality end-to-end: nav path, role name, federal artifact (CMMC
> Status Date), CAGE sign-time gate, public walkthrough page, and
> white-glove copy-paste card.

### 1. Fix the SPRS navigation path everywhere ✅
The real path is **CMMC Assessments tab → "Add New Level 1 CMMC
Self-Assessment"**, not "CMMC Affirmations." Affirmation is a button inside
the assessment, not a separate module.

Update:
- `src/app/assessments/[id]/SprsFilingPrompt.tsx` (~line 398)
- `src/app/assessments/[id]/affirmation/page.tsx` (~line 217)
- `src/app/assessments/actions.ts` comment (~line 1240)
- `src/lib/regulations.ts` (~line 305) — rewrite the canonical paragraph
- ZIP README in `src/app/api/assessments/[id]/bid-package/route.ts` — verify
  it already says "CMMC Assessments module" and align all 7 numbered steps to
  the v4.0 guide

### 2. Name the PIEE role explicitly
Anywhere we mention PIEE, name the required role: **`SPRS Cyber Vendor
User`** (privileged: add/edit/delete) vs **`Contractor/Vendor (Support
Role)`** (view-only). Add a 1-line callout: "Pick `SPRS Cyber Vendor User` —
the support role can't file."

### 3. Replace "SPRS confirmation number" with the actual SPRS artifact
SPRS doesn't issue confirmation numbers. Replace the
`SprsFilingPromptCard` form with:
- **CMMC Status Date** (date picker — the posting date SPRS shows)
- **CMMC Status Type** (locked dropdown showing "Final Level 1
  Self-Assessment" — the only government-visible status)
- **Optional screenshot upload** of the Cyber Reports row showing the entry
- Optional free-text notes
Schema migration: rename `sprs_confirmation_number` → `sprs_status_date` +
`sprs_status_type`; keep the old column nullable for back-compat.

Files: `SprsFilingPrompt.tsx`, `actions.ts` (`recordSprsFilingAction`), DB
schema, `verified/[slug]/page.tsx`.

### 4. Hard-gate CAGE at sign time
Today `isRegistrationStepComplete` lets users sign without CAGE. SPRS keys
on CAGE — without it, the user can't file. In `submitAffirmationAction` add:

```ts
if (ctx.assessment.framework === "cmmc_l1" && !ctx.organization.cage_code) {
  return { error: "Add your CAGE code on the registration step before signing — SPRS is keyed on CAGE." };
}
```

Surface a yellow banner on the sign page if CAGE is missing.

### 5. Add a `/sprs-guide` walkthrough page
Modeled exactly on `src/app/sam-guide/page.tsx`. Steps (no screenshots yet —
build with text + numbered cards; drop in screenshots later):

1. Confirm PIEE account is provisioned with `SPRS Cyber Vendor User` role.
   Show how to add the role from My Account → Add Additional Roles → pick
   `SPRS – Supplier Performance Risk System` → select role → enter
   Location Code / CAGE → submit.
2. **Wait for your CAM to activate.** Explain who the CAM is (the company
   officer who approves PIEE roles for your CAGE). If you ARE the only CAM,
   email `disa.global.servicedesk.mbx.eb-ticket-requests@mail.mil` to
   request activation. This is the #1 reason filings stall.
3. Log in at `https://piee.eb.mil` → click SPRS tile → click Cyber Reports.
4. Pick your HLO from the hierarchy dropdown. Asterisk (*) means you have
   the privileged role on that CAGE. (SAM imports the hierarchy
   automatically — you don't enter it.)
5. Click **CMMC Assessments** tab → **Add New Level 1 CMMC
   Self-Assessment**.
6. Fill in assessment details (Custodia gives you the exact values to copy:
   Assessment Date, Affirming Official name + title + email, CAGE, etc.) →
   **Continue to Affirmation**.
7. If you ARE the AO, click **Affirm**. If not, enter AO email and click
   **Transfer to AO**; they'll get an email to come affirm.
8. Status flips to **Final Level 1 Self-Assessment** (the only
   government-visible status type). Note the posting date.
9. Return to Custodia → paste the CMMC Status Date into the bid-packet
   page to lock the record.

Each step gets a numbered card with the literal button names from the v4.0
guide. Add a placeholder `/public/sprs/` folder for screenshots later.

### 6. Add a "CMMC Status Summary" card the user copies into SPRS
On the bid-packet page, render an explicit, copy-paste-friendly card with
ALL the values SPRS will ask for, in SPRS field order:

- **CAGE Code:** (auto)
- **Assessment Date:** (separate field — see #8)
- **Assessment Scope:** "Enterprise" / "Enclave" (we already capture; print
  the exact text SPRS expects)
- **Compliance Status:** `Final Level 1 (Self)` if `implements_all_17` else
  blocked
- **Affirming Official Name / Title / Email**
- **System Security Plan reference:** (point to the Custodia-generated SSP
  filename + assessment ID)

A `CopyButton` per field so the user can't typo a single value.

---

## P1 — Correctness gaps that may produce a wrong filing

> **Status:** Items 7–11 SHIPPED. Sign-time gate now enforces required AO
> email + role-inbox rejection, separate assessment-completion date,
> mandatory N/A justifications, SAM Entity freshness (soft warning), and
> a 3-checkbox PIEE/CAM readiness self-attestation.

### 7. Make AO email REQUIRED, not optional ✅
SPRS's "Transfer to AO" flow uses email. If the AO isn't logged in to
Custodia, the email is the only way to route the affirmation. Today
`AffirmForm.tsx` marks `affirmingOfficialEmail` optional. Make it required;
validate format; persist to the assessment row and the canonical
attestation packet.

Optional stretch: send a one-time signed link to the AO email to confirm
the affirmation (email-loop verification of the AO).

### 8. Capture Assessment Date separately from Affirmation Date
Today only `affirmed_at` is stored. The Quick Entry Guide's "Enter
Assessment Details" screen asks for the assessment date as a distinct
field. Add `self_assessment_completed_at` (default = `now()` when the user
hits "I'm ready to sign," but editable on the sign screen).

Render both in the SSP and on the bid-packet "CMMC Status Summary" card.

### 9. Require a narrative on `not_applicable`
`controlsMissingEvidence` only fires for `status === "yes"` with zero
artifacts. A user could mark all 15 N/A and pass every gate. AG v2.13
requires the SSP to justify each N/A. Require a 200-char narrative when
`status === "not_applicable"`; surface it in the SSP and the bid-packet.

### 10. SAM registration freshness check
SAM registrations expire annually; SPRS lookups against an expired SAM
record show "Inactive" to primes. In `submitAffirmationAction`, call the
SAM Entity API (cached daily) and warn or block if
`registrationStatus !== "Active"`.

### 11. PIEE / CAM readiness checklist gate
Before the Sign button activates, require the user to acknowledge:
- [ ] I have a PIEE account
- [ ] My PIEE account has the `SPRS Cyber Vendor User` role (or I've
      submitted the request and my CAM has activated it)
- [ ] I can log into SPRS → Cyber Reports and see my CAGE in the hierarchy

This is a self-attestation toggle, not an automated check. Cuts down the
"I signed but I can't actually file" cohort.

---

## P2 — Polish that primes will eventually ask about

### 12. Disclose EE/TD coverage in the SSP top-line sentence ✅
Today the SSP says "implements all 15…" unconditionally even when coverage
came via Enduring Exceptions / Temporary Deficiencies. AG v2.13 expects
disclosure. Hedge the sentence: "…implements all 15 CMMC Level 1 basic
safeguarding requirements, including [N] covered by documented Enduring
Exceptions and [M] covered by Temporary Deficiencies as described in
Section 4."

### 13. Note "L1 has no POA&M" in the bid-package README ✅
Add one line: "Level 1 affirmation is binary — no open items exist at
sign time. `05-remediation-plans.csv` is informational only and lists
historical/POA&M-style notes the user captured for their own tracking."

### 14. Unify the step counter ✅
`STEP_ORDER` in `enforceStepOrder` has 5 enforced steps but the page
headers show 1 of 8 / 2 of 8 / 5 of 8 / 7 of 8 / 8 of 8 in different
files. Pick one canonical list (suggest: 1 Profile → 2 Registration → 3
Scope → 4 Boundary → 5 Practices → 6 Sign → 7 File in SPRS → 8 Bid
Packet) and update every page header + progress bar to match. Make sure
`scope` and `boundary` are gate-enforced too.

### 15. Gate the Scope step ✅ (soft warning, per downgrade)
`src/app/assessments/[id]/scope/page.tsx` is reachable but not enforced in
`enforceStepOrder`. 32 CFR § 170.19 requires a scope inventory.
Add `isScopeStepComplete` (requires People + Tech + Facilities + ESPs
populated) and insert into the step order.

### 16. PracticeChat rollout
PracticeChat (the richest evidence-collection UX) is enabled only for
`AC.L1-3.1.1` via `practice-spec.ts`. The other 16 controls use older
Quiz/Wizard flows. Author chatSpecs for the remaining 16. Track as its
own multi-day effort.

### 17. Charlie-drafted markdown is auto-blocked ✅
The vision-review pipeline returns `unclear`+`model='none'` for
markdown/text evidence, which fails `isEvidencePassing`. Either:
(a) accept text/markdown for narrative-only artifacts where vision review
is meaningless, or
(b) auto-render Charlie's markdown to PDF before storing (already have
PDF generation in the bid-package pipeline — reuse).

### 18. Optional ISSM field separate from AO ✅
Some prime questionnaires want an ISSM (Information System Security
Manager) name + email distinct from the AO. Add to the profile step;
include in the SSP § 3 "Roles & Responsibilities" table; not required
for the SPRS filing itself.

### 19. CAGE/UEI live validation against SAM ✅
Today registration only enforces format. Add a server-side SAM Entity
API lookup on save: confirm the entity exists, name matches, and surface
the entity for the user to confirm. Prevents typo'd CAGE in the signed
canonical packet.

### 20. SPRS API submission (long-term)
DoD has a SPRS Web Services API. Long-term, Custodia could submit the
L1 affirmation programmatically (the user still has to be the AO and
PIEE-authenticated, but we could pre-populate via API). Out of scope
for this round — note for future.

---

## P1.5 — Refinements from the AG L1 v2.13 + Scoping Guide L1 v2.13

These came from reading the two authoritative DoD guides end-to-end.
Insert into the right priority tier as you go.

### 21. Material-change re-assessment trigger (Scoping Guide § 170.19, p. 4) ✅
> "A new assessment is required if there are significant architectural or
> boundary changes to the previous CMMC Assessment Scope. Examples include,
> but are not limited to, expansions of networks or mergers and acquisitions."

Today carry-forward unconditionally clones last year's responses. At
re-affirmation time, add a "material change" interview:

- New offices / facilities?
- Acquisition or merger?
- Major IT migration (M365 → Google, on-prem → cloud, new ESP)?
- Big change in headcount / new contract type that adds FCI handling?

If any → block carry-forward; force a fresh assessment. If none → annual
affirmation only (operational changes within existing scope per AG p. 4).
**Promote to P1.** This is the single thing that keeps year-2 onward
defensible.

### 22. N/A handling — use the AG's example verbatim ✅
AG p. 8 specifically cites: *"SC.L1-b.1.xi might be N/A if there are no
publicly accessible systems within the CMMC Assessment Scope. During an
assessment, an assessment objective assessed as N/A is equivalent to
the same assessment objective being assessed as MET."*

Refines gap **#9** (require N/A narrative): pre-fill suggested
justifications for the requirements most commonly N/A'd at L1
(SC.L1-b.1.xi for shops with no public-facing systems; PE.L1-b.1.ix
auditor logs for 100% remote shops, etc.) and require the user to either
accept or rewrite. Show the AG quote inline so the user understands
the bar.

### 23. "Final forms only" evidence rule — keep the vision gate STRICT ✅
AG p. 7 and § 170.24: *"documents need to be in their final forms;
drafts of policies or documentation are not eligible to be used as
evidence."*

This **validates** the current behavior that auto-blocks Charlie's
markdown drafts. Refines gap **#17**: don't open the floodgates. Instead:
- Add a "Mark as Final Policy" confirmation when the user accepts
  Charlie's draft. Render it to PDF, watermark it "FINAL — adopted
  YYYY-MM-DD by [signer]", and only then store as evidence.
- Keep raw markdown / unfinished notes blocked.

### 24. Per-objective MET/NOT MET tracking in the SSP ✅
AG p. 8: *"CMMC assessments are conducted and results are captured at
the assessment objective level. One NOT MET Assessment Objective
results in a failure of the entire security requirement."*

We already track 59 objectives in `src/lib/cmmc/objectives.ts`. Make
sure the SSP rolls up MET / N/A status **per objective** (a, b, c, …)
under each requirement, not just per requirement. AG p. 8 calls this
"best practice." This is a small SSP rendering change.

### 25. Examine / Interview / Test method tagging on evidence ✅
AG pp. 5–7 define three assessment methods. For each piece of evidence
the user uploads, ask: is this an `examine` artifact (policy,
screenshot, config), an `interview` artifact (Q&A transcript, role
attestation), or a `test` artifact (demo video, screen recording)?

Not required, but having this taxonomy in the SSP makes the package
substantially more defensible if a prime asks "show me the test
evidence for SC.L1-b.1.x." Three-way radio on the evidence upload form.

### 26. "Operational plan of action" ≠ POA&M — fix the language ✅
AG p. 4: *"An operational plan of action is not the same as a POA&M
associated with an assessment."* L1 has no POA&M.

The TD/EE flow already uses operational-plan-of-action semantics, but
the UI says "POA&M" in some spots. Audit `src/app/assessments/[id]/
exceptions/page.tsx`, the deliverables ZIP file `05-remediation-plans.
csv`, and the bid-package README — replace "POA&M" with "Operational
Plan of Action" or "Remediation Plan" everywhere L1 is implied.

### 27. ESP as MET path (AG pp. 8–9) ✅
*"Satisfaction of security requirements may be accomplished by other
parts of the enterprise or an External Service Provider (ESP)... A
security requirement is considered MET if adequate evidence is
provided that the enterprise or ESP implements the requirement
objectives."*

The Scope step already lets users list ESPs (M365, Google, Okta, etc.),
and the provider guidance per practice already exists in `playbook.ts`.
Make sure: when a user marks a control MET via an ESP, the SSP renders
an explicit "Covered by ESP: [Name] — see [evidence artifact]" line
under that control. That's the auditor-defensible disclosure pattern.

---

## What the PDFs let us DOWNGRADE / remove

- **SSP is recommended but NOT required at Level 1** (Scoping Guide
  footnote 2, p. 4; AG footnote 4, p. 12). Custodia generates one anyway
  — that's value-add, not a gap. Item **#12** (EE/TD disclosure in SSP)
  stays useful but isn't strictly required by 32 CFR.
- **Scope documentation is NOT required** at L1: *"There are no
  documentation requirements for Level 1 self-assessments including
  In-Scope, Out-of-Scope, and Specialized Assets"* (Scoping Guide p. 2).
  Item **#15** (gate the Scope step) is still good UX but can be a
  soft gate (warning) rather than a hard block.

## What the PDFs CONFIRM (no change needed)

- 15-requirement model rolling to 59 objectives — correct ✓
- MET / NOT MET / N/A is the only valid outcome trio — correct ✓
- EE in SSP → MET, TD in operational plan of action → MET — correct ✓
- Annual self-assessment + annual affirmation cycle — correct ✓
- "Final Level 1 (Self)" is the canonical CMMC Status string — correct ✓

---

## Recommended sequencing

**Week 1:** P0 #1, #2, #3, #4 — quick wording / gate fixes
**Week 2:** P0 #5, #6 — build `/sprs-guide` + the CMMC Status Summary card
**Week 3:** P1 #7, #8, #11 — sign-time correctness
**Week 4+:** P1 #9, #10 and P2 polish on a rolling basis
**Backlog:** P2 #16, #20

---

## Out-of-scope (deliberate)

- No SPRS API integration (#20) — DoD process expects the AO to log in.
- No automated PIEE role provisioning — that's a CAM action.
- No screenshots in `/sprs-guide` yet — text-first; drop in screenshots
  once we have a clean test PIEE account or the user supplies them.
