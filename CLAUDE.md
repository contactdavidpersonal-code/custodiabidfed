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

- **Middleware file is `src/proxy.ts`**, not `middleware.ts`. It uses Clerk to protect `/dashboard(.*)` and `/assessments(.*)`.
- **Route params and searchParams are Promises.** Use the generated `PageProps<'/some/[id]'>` global helper as the prop type and `await props.params` / `await props.searchParams` inside the component. See `src/app/assessments/[id]/affirmation/page.tsx` for the pattern.
- **Server Actions** live in `actions.ts` files with a top-level `"use server"`. Only async functions may be exported from these modules — do **not** re-export constants, types, or plain objects (e.g. the `playbook`) from an actions file.
- React 19.2, Tailwind v4 (`@tailwindcss/postcss`), TypeScript strict mode, `@/*` → `src/*`.

## Architecture

The product is a TurboTax-style self-serve platform that walks a small defense-tech startup through a **CMMC Level 1 annual SPRS affirmation cycle** (17 FAR 52.204-21 practices across AC/IA/MP/PE/SC/SI domains) and produces a printable SSP + signed affirmation memo.

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
- `src/lib/playbook.ts` — the 17 CMMC L1 practices as data: FAR/NIST references, plain-English copy, per-provider (M365 / Google Workspace / Okta / AD / AWS / manual) walkthroughs, and a `suggestedNarrative(ctx)` function consumed by the "suggest narrative" server action. Adding or editing practices is a pure data edit here — downstream pages iterate `playbook` and `controlDomains`.
- `src/app/assessments/actions.ts` — every mutating server action for the wizard (create cycle, update profile, save response, upload/delete evidence, suggest narrative, submit affirmation). Always calls `auth()` → `requireUserId()` first and scopes queries via `getAssessmentForUser(id, userId)` to enforce ownership.

### Environment

- `DATABASE_URL` — Neon Postgres connection string (required; `getSql()` throws without it).
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (required for evidence upload/delete in production).
- Clerk publishable/secret keys — standard `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.

### Design system

Light theme. App background `slate-50`, cards white with `border-slate-200` and `rounded-2xl`/`rounded-xl` + `shadow-sm`. Primary action is `slate-900`; brand accent is `amber-400` (hover `amber-300`) with `amber-50`/`amber-700` for soft fills. Status colors: emerald (met / attested), amber (partial / review), rose (not met / blocker), sky (in progress), slate (archived / N/A). Radio-card status pickers use Tailwind's `has-[:checked]:` variant for CSS-only styling. Keep apostrophes/quotes in JSX text as HTML entities (`&apos;`, `&ldquo;`, `&rdquo;`) — `react/no-unescaped-entities` is on.
