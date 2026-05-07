@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `custodiabidfed/`.

- `npm run dev` — Next.js dev server (Turbopack) on :3000
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint (uses flat config `eslint.config.mjs`; runs `next/core-web-vitals` + `next/typescript`)
- `npx tsc --noEmit` — type-check (no `typecheck` script defined)
- `npx next typegen` — regenerate `.next/types/**` after adding/renaming route segments. **Do this before type-checking whenever a new route is added** so `PageProps<'/your/path'>` resolves correctly.

There is no test runner configured.

## Next.js caveats (read this before writing route code)

`AGENTS.md` warns: this is **Next.js 16.2.4** and diverges from older conventions. Authoritative docs live in `node_modules/next/dist/docs/`.

- **Middleware file is `src/proxy.ts`**, not `middleware.ts`. It uses Clerk to protect `/dashboard(.*)`, `/assessments(.*)`, and `/onboard(.*)`.
- **Route params and searchParams are Promises.** Use the generated `PageProps<'/some/[id]'>` global helper as the prop type and `await props.params` / `await props.searchParams` inside the component. See `src/app/assessments/[id]/affirmation/page.tsx` for the pattern.
- **Server Actions** live in `actions.ts` files with a top-level `"use server"`. Only async functions may be exported from these modules — do **not** re-export constants, types, or plain objects (e.g. the `playbook`) from an actions file.
- React 19.2, Tailwind v4 (`@tailwindcss/postcss`), TypeScript strict mode, `@/*` → `src/*`.

## Architecture

The product is a guided self-serve platform that walks a small defense-tech startup through a **CMMC Level 1 annual SPRS affirmation cycle** (15 FAR 52.204-21(b)(1)(i)–(xv) safeguarding requirements across AC/IA/MP/PE/SC/SI domains) and produces a printable SSP + signed affirmation memo.

> **Authoritative count: 15 safeguarding requirements.** Per the official DoD CMMC Scoping Guide — Level 1 (v2.13, Sept 2024) and FAR 52.204-21(b)(1)(i)–(xv). Older industry articles cite 17 because the CMMC Assessment Guide splits one FAR requirement into multiple sub-practices. **Never write "17 practices" or "17 controls" in user-facing copy, legal artifacts (SSP / affirmation memo), or marketing.** Internal `playbook.ts` may contain 17 CMMC practice IDs; that data structure is correct — only the prose count must say 15.

### Data flow per cycle

1. User signs in (Clerk) → redirected to `/assessments` (fallback URLs set in `src/app/layout.tsx` on `<ClerkProvider>`).
2. `ensureOrgForUser(userId)` returns-or-creates a single `organizations` row keyed by `owner_user_id`. One user = one org; **Clerk Organizations are not used**.
3. User starts a cycle → `assessments` row + one `control_responses` row per practice (status defaults to `unanswered`).
4. Per-control page (`/assessments/[id]/controls/[controlId]`): status radio, narrative, evidence uploads. Uploads go to **Vercel Blob** via `put()` at path `evidence/<assessmentId>/<controlId>/<timestamp>-<safeName>`; the returned URL is stored in `evidence_artifacts.blob_url`. Deletes call `del()` (wrapped in try/catch because the blob may already be gone) before `DELETE FROM evidence_artifacts`.
5. `/assessments/[id]/sign` gates on readiness (profile complete, no unanswered, no `no`, no `partial`). `submitAffirmationAction` flips status to `attested`, writes `affirmed_at/by_name/by_title`, and sets `sprs_score = 110` when all met.
6. `/ssp` and `/affirmation` render print-ready HTML. **PDF output is browser print-to-PDF**, not server-side rendering — driven by the `@media print` block in `src/app/globals.css` (`@page { size: letter; margin: 0.75in; }`, `.print:hidden` helper) plus the `PrintButton` client component.

### Key modules

- `src/lib/db.ts` — Neon serverless client + typed enums (`assessmentStatuses`, `controlResponseStatuses`, etc.). `initDb()` contains **all DDL** including IF-NOT-EXISTS migrations (e.g. the `clerk_org_id` → `owner_user_id` backfill). It's called lazily from the first data function in a request; there is no separate migration system.
- `src/lib/assessment.ts` — all org/assessment/response/evidence queries. Progress aggregates (`AssessmentWithProgress`) are computed here, not in the DB.
- `src/lib/playbook.ts` — the CMMC L1 practices as data (17 CMMC practice IDs mapping to the 15 FAR safeguarding requirements): FAR/NIST references, plain-English copy, per-provider (M365 / Google Workspace / Okta / AD / AWS / manual) walkthroughs, and a `suggestedNarrative(ctx)` function consumed by the "suggest narrative" server action. Adding or editing practices is a pure data edit here — downstream pages iterate `playbook` and `controlDomains`.
- `src/app/assessments/actions.ts` — every mutating server action for the wizard (create cycle, update profile, save response, upload/delete evidence, suggest narrative, submit affirmation). Always calls `auth()` → `requireUserId()` first and scopes queries via `getAssessmentForUser(id, userId)` to enforce ownership.

### Charlie — the AI compliance officer

- `src/lib/ai/charlie/index.ts` is the **runtime source of truth** for Charlie's system prompt. The mirror at `system-prompt.md` is human-readable reference only. Bump `CHARLIE_PROMPT_VERSION` whenever behavior changes so AI conversation rows can reproduce.
- `src/lib/ai/tools.ts` defines every tool Charlie can call (`cite_regulation`, `escalate_to_officer`, `search_sam_opportunities`, `analyze_opportunity_fit`, `propose_milestone`, etc.). Tools are deliberately read-mostly — riskier actions (editing responses, deleting evidence, submitting the affirmation) stay human-only. Every tool is bound to `ctx.organizationId` derived server-side from `userId`, so the LLM cannot pivot tenants.
- `src/lib/ai/evidence-review.ts` runs vision review on every uploaded artifact. Verdicts (`sufficient` / `insufficient` / `unclear` / `not_relevant`) gate attestation — see the auto-memory note about never letting attestation be trickable.
- `src/lib/ai/conversations.ts`, `memory.ts`, `stream.ts` — conversation persistence, long-term memory, streaming wrappers. PII is regex-scrubbed in user-supplied text before it leaves the perimeter for Anthropic.

### Encryption (Tier 2 zero-trust)

Application-layer envelope encryption with **per-tenant Data Encryption Keys (DEKs)** wrapped under a platform Key Encryption Key (KEK). Every `organizations` row carries a `wrapped_dek`. Evidence blobs, signer name/title, and the canonical attestation packet are all encrypted with the tenant DEK before they hit storage. Wire formats are versioned: `fv2`/`cfb2` use the tenant DEK; legacy `fv1`/`cfb1` decrypt directly under the KEK. **Don't introduce a new format without bumping the version prefix and updating both encrypt and decrypt paths.** Crypto-shred (delete `wrapped_dek` → all v2 ciphertext for that tenant becomes permanently unreadable) is a first-class operation. KEK bootstrap: `scripts/bootstrap-kms-kek.ts`.

Evidence reads always go through `/api/evidence/[artifactId]` (re-checks tenant on every byte and decrypts). Blob URLs never cross the server/client trust boundary.

### Cron + scheduler

`vercel.json` registers eight crons hitting `/api/cron/*`: fiscal-rollover, milestone-reminders, evidence-freshness, sam-radar, generic `scheduler` (every 5 min, dispatches via `src/lib/scheduler/`), trust-status-rollup, encryption-backfill, trial-drip. All cron handlers verify `CRON_SECRET` via constant-time bearer compare (`src/lib/security/cron.ts`).

### Connectors

`src/lib/connectors/` + `src/app/api/connectors/{google,m365}/` — OAuth-based pulls (separate from manual evidence upload). Tokens are encrypted with the tenant DEK. Connectors register through `connectors/registry.ts`.

### Bid Radar

Secondary product surface — `/bid-radar`, `/opportunities`. `src/lib/sam-radar.ts` queries SAM.gov (gated by user-supplied API key); `opportunities-live-cache.ts` caches results. Charlie can search/analyze/dismiss via tools. The weekly `sam-radar` cron refreshes inboxes.

### Observability

Sentry wraps `next.config.ts` via `withSentryConfig`; client/server/edge configs in `instrumentation*.ts` and `sentry.*.config.ts`. Browser ingest is tunneled through `/monitoring` so ad blockers don't drop reports. The `audit_log` table is the append-only system of record for attestation, signing, evidence handling, exports, cron, auth, and rate-limit events.

### Security headers

`next.config.ts` ships HSTS preload, X-Frame-Options DENY, COOP same-origin, CORP same-site, and a CSP. **CSP is currently `Content-Security-Policy-Report-Only`** — flip to enforcing only after two clean weeks of telemetry. Anthropic is intentionally not in `connect-src` (server-to-server only). Adding a new third-party host means updating `cspDirectives`.

### Environment

Required in production (validated at boot in `src/lib/security/env.ts`; throws if missing):
- `DATABASE_URL` — Neon Postgres connection string.
- `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk auth.
- `ANTHROPIC_API_KEY` — Charlie + evidence review.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (evidence upload/delete).
- `ATTESTATION_SIGNING_KEY` — HMAC signing for attestations; also the HKDF source for the field-encryption KEK fallback when `FIELD_ENCRYPTION_KEY` is unset.

Recommended (warn in prod):
- `CRON_SECRET` — bearer for `/api/cron/*`.
- `RESEND_API_KEY` — transactional email (welcome, trial drip, officer tickets, etc. in `src/lib/email/`).

### Design system

Light theme. App background `slate-50`, cards white with `border-slate-200` and `rounded-2xl`/`rounded-xl` + `shadow-sm`. Primary action is `slate-900`; brand accent is `amber-400` (hover `amber-300`) with `amber-50`/`amber-700` for soft fills. Status colors: emerald (met / attested), amber (partial / review), rose (not met / blocker), sky (in progress), slate (archived / N/A). Radio-card status pickers use Tailwind's `has-[:checked]:` variant for CSS-only styling. Keep apostrophes/quotes in JSX text as HTML entities (`&apos;`, `&ldquo;`, `&rdquo;`) — `react/no-unescaped-entities` is on.
