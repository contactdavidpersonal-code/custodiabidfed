# Custodia → CMMC Level 1 Platform Pivot

**Tagline:** Federal bid-ready in 7 days. Compliant for life.
**Positioning:** TurboTax for CMMC Level 1 — guided by **Charlie**, your AI compliance officer.
**Scope discipline:** CMMC L1 only. BidFed becomes a "Bid Radar" bonus feature, not the headline. L2 / CUI / FedRAMP-for-customers are explicitly out of scope for v1 and become the cyber-firm services upsell.

---

## Guiding Principle: Charlie Drives Everything

Charlie is the AI compliance officer persona. The customer never sees a 17-control checklist, a NIST citation, or the string "AC.L1-3.1.1" unless they click "show me the regulation." Charlie talks like a trusted advisor:

> *"Hey — I'm Charlie. I'll walk you through the 17 things DoD wants you to confirm. Most take seconds. I'll tell you when something needs fixing and exactly how to fix it. Ready?"*

Every flow below is an **interview**, not a form. TurboTax model:
- One question per screen
- Plain English, never jargon
- Progress bar with sections (Identity → Access → Devices → Files → People → Incidents)
- "Why we ask" expandable note on every question (maps to FAR 52.204-21 control)
- Inline AI help: *"Not sure? Ask Charlie."*
- Save & resume on every step
- Smart skip: if M365 connector answered it, skip the question entirely

---

## Scope of v1 (the only things we ship to GA)

### 1. Charlie Interview Engine (replaces current assessment UI)

**What it is:** A branching, plain-English Q&A that maps to the 17 FAR 52.204-21 / CMMC L1 controls behind the scenes.

**Interview sections (TurboTax-style chapters):**
1. **About Your Business** (entity, EIN, NAICS, federal contract status)
2. **Your Email & Files** (M365 / Google / other) — auto-detects most controls via connectors
3. **Who Has Access** (employee count, contractors, MFA, password policy)
4. **Your Devices** (laptops, BYOD, AV, patching, screen lock, encryption)
5. **Your Network** (router, Wi-Fi, VPN, public Wi-Fi rules)
6. **Sharing & External** (file sharing with non-employees, customer portals)
7. **Incidents & Recovery** (have you had one, do you have a plan)
8. **Physical Security** (locked office? home offices?)
9. **Review with Charlie** (gap list, fixes, ETA to attest)

**Question style examples:**
- ❌ "AC.L1-3.1.1: Limit information system access to authorized users"
- ✅ "Does anyone outside your company log into your email or files? *(employees with company accounts don't count)*"

**Smart features:**
- AI-generated follow-ups when an answer is ambiguous
- "Charlie's gut check" — if answers contradict (e.g., "no MFA" but "M365 Business Premium"), Charlie flags it
- Photo upload for evidence (lock on door, screen lock screenshot)
- Voice answers (mobile)

**Data model (eng-review locked):** Question content lives in versioned YAML, not TypeScript, so non-engineers (compliance officer, outside counsel, you) can edit copy without a deploy.

- `src/lib/cmmc/questions/*.yaml` — one file per chapter, validated by a `zod` schema
- `src/lib/cmmc/question-schema.ts` — typed schema (question, answer types, control mappings, branching rules, evidence hints)
- `src/lib/cmmc/control-mapping.ts` — FAR 52.204-21 ↔ question IDs (single source of truth)
- `src/lib/cmmc/interview-engine.ts` — pure tree walker, dumb renderer
- `src/app/cmmc/interview/page.tsx` — the interview UI
- `src/lib/ai/charlie/system-prompt.md` — versioned Charlie persona prompt; every conversation row logs which version was used
- `src/lib/ai/charlie/index.ts` — Charlie runtime + prompt loader
- Reuse existing `src/lib/assessment.ts` and `src/lib/ai/conversations.ts`

**Versioning rule:** every attestation snapshots the question-set version it was generated against, so a customer's signed artifacts always reproduce.

**Estimate:** Largest single workstream. Build the engine + schema first; the 9 chapters are then content work in parallel.

---

### 2. Free Public SPRS Quiz (lead-gen engine)

**What it is:** A 5-minute, no-signup, public quiz at `/sprs-check` that gives a real-time SPRS-style score (out of 110, scaled to L1) and a branded PDF gap report by email.

**Flow:**
1. Land on `/sprs-check` — *"Find out your CMMC Level 1 score in 5 minutes. Free. No signup."*
2. 12–15 of the most diagnostic interview questions
3. Live SPRS-style gauge that ticks up/down as they answer
4. Final screen: *"Your score: 78/110. You have 4 gaps. Get them fixed and attested in Custodia: 14-day free trial."*
5. Email capture → branded PDF report → drip campaign

**PDF report contents:**
- Cover page with their company name (filled from email domain)
- Score + bar chart
- Each gap: plain-English finding + plain-English fix + estimated time/cost to fix
- "Fix this in Custodia in 7 days" CTA

**Files to build:**
- `src/app/sprs-check/page.tsx` — public quiz UI
- `src/app/api/sprs-check/route.ts` — score calculation, PDF generation
- `src/lib/cmmc/sprs-scoring.ts` — scoring algorithm (NIST 800-171A weighted)
- `src/lib/pdf/gap-report.tsx` — PDF generator (uses standardized `@react-pdf/renderer` — see PDF stack rule below)
- Email drip via existing `src/lib/email/`

**Eng-review rule — PDF stack standardization:** All PDF generation across the platform uses **`@react-pdf/renderer` only**. No `puppeteer`, no `pdfkit`, no headless Chrome. Every additional PDF stack adds CVE surface, fontconfig issues, and serverless cold-start pain. This applies to gap reports, the artifact pack (§4), trust pages exported as PDF, and anything else that produces a PDF.

**Why this is critical:** Free, viral, costs nothing per use after build, converts cold traffic. Single highest-leverage feature for growth.

---

### 3. Evidence Connectors (one-click compliance)

#### 3a. Microsoft 365 / Entra ID
OAuth app + Graph API. Auto-pulls:
- MFA enforcement status (per user)
- Conditional access policies
- User account inventory + last sign-in
- Audit log retention
- Defender for Business status (AV)
- Intune compliance (patch level, encryption, screen lock)
- Sign-in failure rates (anomaly baseline)
- External sharing settings (SharePoint/OneDrive)

**Files:** `src/lib/connectors/m365.ts`, `src/app/api/connectors/m365/`, OAuth callback route.

#### 3b. Google Workspace
OAuth + Admin SDK / Reports API. Auto-pulls:
- 2-Step Verification status (per user)
- User inventory + last login
- Drive external sharing
- Endpoint management compliance
- Audit log access
- Login activity

**Files:** `src/lib/connectors/google-workspace.ts`, `src/app/api/connectors/google/`.

#### 3c. Endpoint Agent (lightweight) — **partner, do not build**
Cross-platform (Windows / macOS) posture data:
- OS version + last patch date
- AV/EDR present and active
- Disk encryption (BitLocker / FileVault)
- Screen lock policy
- Local admin accounts

**Eng-review decision:** **Whitelabel Fleet (open-source osquery)** for v1. Building a signed cross-platform agent is a 4–8 week distraction with permanent maintenance burden (code-signing certs, OS updates, kernel ext changes, MDM compatibility). Fleet is open-source, MIT-licensed, battle-tested, and integrates via API. Estimated COGS: **$0–$4 per endpoint/month** depending on hosting choice. Most SMBs have <25 endpoints → worst case ~$100/customer/month against $249 ARPU. Acceptable.

Revisit a custom agent only if (a) margins demand it at >1,000 customers or (b) FedRAMP requires a fully-controlled supply chain.

#### 3d. Manual upload fallback
For everything not covered: drag-and-drop with AI-assisted classification ("This looks like a screenshot of MFA settings — is that what you're uploading?").

**Files to build:** `src/lib/connectors/index.ts` (registry), `src/app/connectors/page.tsx` (UI), per-connector OAuth + sync routes, evidence storage in existing `src/lib/ai/evidence-review.ts` pipeline.

**Estimate:** M365 first (largest market share among DoD SMBs), Google second, agent third, manual always.

---

### 4. One-Click Signed Artifact Pack

**The deliverable bundle** (auto-generated, customer-branded, signed):

| Artifact | Purpose | Existing? |
|---|---|---|
| **System Security Plan (SSP)** | Required L1 narrative document | Partial (`artifact-generation.ts`) |
| **Attestation Letter** | Signed CMMC L1 self-assessment statement | Partial (`attestation-signature.ts`) |
| **SPRS Submission Record** | Cryptographically signed score + timestamp + filer identity | New |
| **Capability Statement** | One-pager every CO requests | New |
| **Compliance Officer Designation Memo** | Names internal point of contact | New |
| **Acceptable Use Policy (AUP)** | Required template policy | New |
| **Incident Response Plan (IRP)** | Required template policy | New |
| **Access Control Policy (ACP)** | Required template policy | New |

**Requirements:**
- Single "Generate My Pack" button after attestation
- Each document branded with company logo, name, address, EIN, UEI, CAGE
- All signed with same attestation key chain (existing `attestation-signature.ts`)
- Lawyer-reviewed templates (need to engage outside counsel for one-time review — budget $3–5K)
- Versioned and stored permanently in evidence vault
- Download as ZIP + individual PDFs + shareable trust page link

**Files to build:** `src/lib/artifacts/` directory: `ssp.tsx`, `attestation.tsx`, `sprs-record.tsx`, `capability-statement.tsx`, `officer-memo.tsx`, `aup.tsx`, `irp.tsx`, `acp.tsx`. PDF generator via `@react-pdf/renderer`.

---

### 5. Audit Support Included (path to "Audit Defense Guarantee")

**Phase 1 (ships at launch, no legal exposure):** *"Audit Support Included — if DoD ever questions your CMMC L1 attestation, your compliance officer is on the line at no additional cost."*

**Phase 2 (ships after outside counsel signs off):** Upgrade language to **"Audit Defense Guarantee"** with formal terms.

**Why phased:** A "guarantee" is a contractual promise that creates legal exposure. Until counsel reviews the carve-outs (fraud, false answers, scope changes, customer non-cooperation), keep the marketing language as "Included" / "On Call" — same product behavior, no liability tail.

**What ships at launch:**
- Marketing page (`/audit-support`) explaining the included support
- Plain-English terms (no contractual guarantee yet)
- "Request Audit Support" workflow → ticket → assigned officer
- Internal SLA tracking (24-hour first response)

**What ships in Phase 2 (post-counsel):**
- Rebrand `/audit-support` → `/audit-defense` with guarantee language
- Click-wrap legal terms with documented carve-outs
- Reserve ~5% of revenue against a defense fund

**Files:** `src/app/audit-support/page.tsx`, `src/app/api/audit-support/`, plain-English terms doc.

---

### 6. Continuous Compliance Monitoring

**What it is:** Once attested, the platform watches the customer's posture year-round and nudges them before things break.

**Monitors:**
- **MFA drift** — someone turned off MFA on an account → red alert + auto-remediation playbook
- **Patch lag** — endpoint hasn't updated in >30 days → yellow nudge → red at >60
- **New user without role assignment** → yellow within 24h
- **Failed login spike** — anomaly baseline → red on threshold breach
- **Suspicious sharing** — file shared externally that contains "FCI" or DoD-pattern keywords → flag
- **SAM expiration** — 90 / 60 / 30 / 7 / 1 day reminders, plus auto-renewal walkthrough
- **CMMC re-attestation** — 60-day notice before annual cycle, Charlie kicks off re-interview only on changed items
- **Policy update** — when DoD updates CMMC guidance or NIST 800-171 → Charlie shows the diff

**Files to build:**
- `src/lib/monitoring/` directory: `mfa-drift.ts`, `patch-lag.ts`, `role-gap.ts`, `login-anomaly.ts`, `sharing-watch.ts`
- Per-customer scheduler driven by a `scheduled_tasks` table (`next_run_at`, `kind`, `customer_id`) — **not** hardcoded global crons
- One thin Vercel cron (`/api/cron/scheduler`) every 5 minutes that pulls due rows and dispatches them
- Alert pipeline → existing `src/lib/escalations.ts`

**Eng-review rule:** Compliance Pulse, SAM-renewal reminders, and CMMC re-attestation reminders are all **per-customer scheduled events**, not global crons. A global Monday-9am cron breaks at scale (timezones, batch sizes, retries). The DB-driven scheduler is the only correct shape.

---

### 7. Weekly Compliance Pulse Email

**What it is:** A simple, well-designed weekly email every Monday morning.

**Format:**
- **Status:** 🟢 Green / 🟡 Yellow / 🔴 Red
- **What changed this week:** 3-bullet summary
- **What needs your attention:** 0–3 action items with one-click links
- **What's coming up:** SAM renewal in 67 days, re-attestation in 134 days
- **Bid Radar:** 3 new contracts you're now eligible for (BidFed crossover)
- Signed: *"— Charlie, your compliance officer"*

**Files:** `src/lib/email/compliance-pulse.ts`, weekly cron in `src/app/api/cron/compliance-pulse/route.ts`, MJML template.

---

## Pricing — Flat $249/month, Everything Included

**Owner directive:** one package, one price, no tiers, no annual discount split.

| Plan | Price |
|---|---|
| **Custodia CMMC L1** | **$249 / month** — everything included |
| 14-day free trial | $0 — full product, card required, auto-converts |
| Free public SPRS Check | $0 — no signup, instant score + emailed PDF gap report |

**Pricing page UX:**
- Single price displayed. No toggles, no tier ladder, no "compare plans" table.
- Single "Start 14-day Free Trial" CTA.
- Money-back guarantee: full refund if not bid-ready within **30 calendar days** (published guarantee). Marketing target stays **7 business days**.
- Annual prepay option offered post-checkout for customers who ask (no public discount — keeps the "one price" message clean).

### What's included in the $249/mo

- Full Charlie interview (all 9 chapters)
- All evidence connectors (M365, Google Workspace, endpoint agent, manual upload)
- Signed artifact pack (SSP, attestation, SPRS record, capability statement, officer memo, AUP, IRP, ACP)
- Continuous compliance monitoring + weekly Compliance Pulse email
- SAM and CMMC renewal calendar with 90/60/30/7-day reminders
- **Audit Support Included** *(branded as "guarantee" only after counsel sign-off — see §5)*
- Async compliance officer review (24-hour SLA)
- Bid Radar (3 NAICS-matched contracts/week)
- Trust page for the customer's own use
- Unlimited Charlie chat

### Add-ons (services, not subscription changes)

| Add-on | Price | Use case |
|---|---|---|
| Live Compliance Officer call | $250 / 60-min session | On-demand human help |
| Done-For-You onboarding | $2,500 one-time | Officer drives the 7-day setup |
| Cyber Firm Services (L2 / CUI / GCC High / vCISO) | Custom quote | Customers who outgrow L1 |

These never change the $249/mo platform price.

### Pricing rationale

- **$249/mo** sits below the typical $300 SMB procurement-card threshold — founder swipes a card, no approval cycle.
- **Flat pricing eliminates objection handling.** No "which tier do I need?" friction — the answer is always "yes, all of it."
- Consultants charge **$5–12K** for the same outcome in 90 days. We deliver in 7 for ~25% of year-one cost.
- **Annual contract value: $2,988.** Healthy SaaS unit economics at this ARPU once CAC is paid back (target <6 months).

---

## Repo / Surface Restructure

**Demote BidFed:**
- Move `/opportunities` to `/bid-radar` (rebrand as bonus feature)
- Remove BidFed-first messaging from landing page
- Keep `assessments/` flow but rebrand internally as "interview"
- New top-level routes:
  - `/` — TurboTax-for-CMMC landing page
  - `/sprs-check` — free public quiz
  - `/cmmc/interview` — the Charlie interview
  - `/cmmc/evidence` — connectors + uploads
  - `/cmmc/artifacts` — one-click pack generation
  - `/cmmc/monitor` — continuous compliance dashboard
  - `/audit-support` — Phase 1 marketing (becomes `/audit-defense` after counsel)
  - `/bid-radar` — demoted BidFed feature
  - `/meet-charlie` — Charlie's bio + CMU credentials wall

**Brand (CEO-review additions):**
- **Charlie has a face, voice, and bio.** Portrait, CMU lanyard, signed introduction message in onboarding. The CMU credentials only convert if Charlie embodies them. Default name **Charlie** (gender-neutral, friendly, memorable). Voice: plainspoken, never condescending, CMU-credentialed.
- Footer everywhere: *"Built by Carnegie Mellon-trained information security engineers."*
- Trust page per customer: `trust.custodia.app/{slug}`. **Opt-in by default**, public-by-URL but unindexed unless customer toggles "public listing." Static-rendered via ISR (`revalidate: 3600`).
- **Trust pages move to MVP+1, not post-launch** — they are half the growth flywheel (every customer becomes a billboard) and worth the small extra build.

**Security (eng-review additions):**
- All connector OAuth tokens encrypted at rest with envelope encryption (extend `src/lib/security/crypto.ts`). Connector tokens are the highest-value secrets in the system.
- Charlie system prompt is a versioned config artifact (`src/lib/ai/charlie/system-prompt.md`). Every AI conversation row logs the prompt version used.

---

## Out of Scope for v1

- ❌ CMMC Level 2 / CUI handling — cyber firm services upsell
- ❌ FedRAMP authorization for customers — *we* pursue FedRAMP Low for ourselves later
- ❌ SOC 2 / ISO 27001 / HIPAA — Vanta's lane
- ❌ Proposal writing / capture management — different product
- ❌ Award guarantee — not a promise we make
- ❌ GCC High / Azure Government deployment — comes with FedRAMP track

---

## Build Order (CEO + eng review locked)

**MVP (must ship to GA):**
1. **Charlie interview engine** (schema + YAML chapters + engine) + **Sections 1–2** (Identity, Email & Files)
2. **Free SPRS quiz + PDF gap report** — moved up because it's lead-gen and runs while the rest builds
3. **M365 / Entra connector** (covers ~70% of evidence for most SMBs)
4. **Pricing / Stripe / 14-day trial wiring** ($249/mo flat)
5. **Landing page rewrite + repo restructure + Meet Charlie page**

**MVP+1 (ships within weeks of GA):**
6. **Sections 3–9 of interview** (rest of the controls)
7. **Signed artifact pack** (SSP, attestation, SPRS, policies, cap statement, officer memo)
8. **Trust pages (public, opt-in)** — promoted from post-launch per CEO review
9. **Manual evidence upload fallback**
10. **Audit Support marketing page (Phase 1)**

**Post-launch:**
11. **Google Workspace connector**
12. **Continuous monitors + per-customer scheduler + Compliance Pulse email**
13. **Renewal calendar wiring (SAM 90/60/30/7, annual CMMC re-attest)**
14. **Fleet (osquery) endpoint integration** — partner, not build
15. **Audit Defense Guarantee Phase 2** (after outside counsel sign-off)
16. **Refer-a-contractor program**

---

## Decisions Locked (resolved by CEO + eng review)

| # | Decision | Locked answer |
|---|---|---|
| 1 | Endpoint agent — build vs. partner | **Partner.** Whitelabel Fleet/osquery in v1. Revisit at scale. |
| 2 | Charlie persona | **"Charlie"** — gender-neutral, friendly, CMU-credentialed. Gets a face, bio, and `/meet-charlie` page. |
| 3 | Outside counsel budget | **$3–5K approved** for policy templates + Audit Defense Phase 2 terms. |
| 4 | Trust pages | **Opt-in by default**, public-by-URL but unindexed unless customer toggles. Promoted to MVP+1. |
| 5 | Bid Radar | **Included in the $249/mo, capped at 3 contracts/week.** No upsell tier. |
| 6 | Data residency | **Standard AWS/Azure us-east** for v1. **GovCloud** when FedRAMP Low track begins. |
| 7 | Pricing | **Flat $249/mo, one package, everything included.** No tiers. |
| 8 | Public guarantee | **"Bid-ready in 7 days" (target) / 30-day money-back (guarantee).** |
| 9 | Audit promise wording | **"Audit Support Included"** at launch → **"Audit Defense Guarantee"** after counsel sign-off. |
| 10 | PDF stack | **`@react-pdf/renderer` only.** No puppeteer / pdfkit. |
| 11 | Schedulers | **Per-customer DB-driven**, not global crons. |
| 12 | Question authoring | **Versioned YAML + zod schema**, editable without deploy. Every attestation snapshots the version. |

---

## Success Metrics for v1

- 🎯 **5-min SPRS quiz → email capture conversion**: target ≥30%
- 🎯 **Email → 14-day trial start**: target ≥10%
- 🎯 **Trial → paid conversion**: target ≥25%
- 🎯 **Time-to-attestation (median)**: target ≤7 business days
- 🎯 **Artifact pack generation time**: target <60 seconds end-to-end
- 🎯 **Continuous-compliance customers staying green**: target ≥80% of base
- 🎯 **First-year retention**: target ≥85% (regulatory lock-in is structural)
