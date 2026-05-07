# MSP Multi-Tenant — Clerk Organizations

**Goal:** Let one user (e.g. an MSP technician or a multi-business owner) manage multiple businesses' CMMC L1 assessments from one account, switching between them via a header button. Same flow, same copy — only the data scope changes per active organization.

**Pricing model:** Clerk Billing per-seat tiers (already supports "limit organization members up to N"). MSP plans are sold per-managed-business by capping the **number of organizations** the user can create/be an admin of, gated by Clerk plan features.

---

## Current architecture (what we already have)

- `organizations` table (in our DB) keyed by `owner_user_id` (Clerk user id). One per user today.
- Every domain row hangs off `organization_id`: `assessments`, `evidence_artifacts`, `control_responses`, `escalations`, etc.
- Every server file calls `const { userId } = await auth()` then `ensureOrgForUser(userId)` to resolve the single org.
- Auth in [src/proxy.ts](src/proxy.ts) protects `/dashboard`, `/assessments`, `/onboard`, `/admin`.
- `<AdminLink />` in [src/components/AdminLink.tsx](src/components/AdminLink.tsx) is the existing pattern for header buttons.

**Key insight:** because everything is already keyed by `organization_id`, switching the active business = switching which `organization_id` we resolve. **No row-by-row tenancy refactor needed** — only the resolution function changes.

---

## Target architecture

- **One Clerk Organization = one business = one `organizations` row in our DB.**
- Add `clerk_org_id text unique` column to `organizations`. Backfill: each existing user's personal org gets migrated to a Clerk Organization auto-created for them on next sign-in.
- New resolver: `ensureOrgForActiveContext({ userId, clerkOrgId })`:
  - If `clerkOrgId` present → look up `organizations.clerk_org_id = clerkOrgId`, create if missing.
  - If no `clerkOrgId` (personal account) → existing behavior (`owner_user_id`).
- Every `await auth()` in the codebase changes from `{ userId }` to `{ userId, orgId }` and passes both into the resolver. **One-line edit per file**, ~50 files.

---

## UX

### Header button (the part the user explicitly asked for)
- Add `<OrgSwitcher />` next to `<AdminLink />` in the header (used in `/cmmc-check`, `/dashboard`, `/assessments`, etc.).
- Renders Clerk's `<OrganizationSwitcher />` component — out-of-the-box dropdown that lists orgs, lets the user create new ones, and switches active org with one click.
- Configured props:
  - `hidePersonal={false}` — keep the personal account so existing solo users aren't disrupted.
  - `createOrganizationMode="modal"` — pop-in business creation (asks for the business name; the underlying `organizations` row is auto-created on first protected page load).
  - `afterSelectOrganizationUrl="/dashboard"` — switch lands on dashboard scoped to new org.
  - `afterCreateOrganizationUrl="/onboard"` — new business goes through onboarding.
  - `appearance` — match `clerk-appearance.ts` so the button visually fits.

### What the user sees
- Solo user (today): one organization auto-created, switcher shows their business name + "Personal" — they can ignore it.
- MSP user: clicks switcher → sees a list ("Acme Defense", "Beta Manufacturing", "Gamma Cyber") → switches → entire site reflects that org's data.
- Creates a new business: switcher → "Create organization" → enters business name → lands on `/onboard` for that business.

---

## Pricing tiers (Clerk Billing, per the screenshots)

Use the **organization-level** plan tab (Configure → Billing → Plans → "Organization" tab) with the **Seat-based / Limit organization members** option, but applied as a **per-organization-count** limit via Clerk's Plan Features:

Actually — reading the screenshot again, the "seat-based" model in Clerk Billing limits members **per org**, not orgs **per user**. We don't want to limit team members inside one business; we want to limit **how many businesses** the MSP can manage.

**Solution: define a Plan Feature "managed_orgs" with a numeric limit.**

| Plan | Monthly fee | Feature: `managed_orgs` |
|------|-------------|-------------------------|
| Self-Serve (existing) | $449 | 1 |
| MSP Starter | $399 | 5 |
| MSP Growth | $999 | 15 |
| MSP Scale | $1,999 | 40 |
| MSP Unlimited | $3,499 | 999 |

- Configure these in Clerk Dashboard → Billing → Plans → User tab (subscription is on the user, not the org, since the user is the MSP).
- Each plan has a "feature" entry `managed_orgs:N`.
- Server enforcement on org creation: `auth().has({ feature: "managed_orgs" })` returns the limit; we count `clerkClient.users.getOrganizationMembershipList({ userId })` and reject if >= N.
- Easier alternative for v1: **don't enforce server-side at all** — just price by trust, and add a soft "Need more? Upgrade." nag in the switcher when the user is at their plan limit. Reduces engineering effort by 1 day. Recommended for first ship.

---

## Migration plan (zero-downtime)

1. **Schema:** `ALTER TABLE organizations ADD COLUMN clerk_org_id text UNIQUE NULL;` — nullable, no breakage.
2. **Resolver:** new `resolveActiveOrg({ userId, clerkOrgId })`:
   - If `clerkOrgId`: `SELECT … WHERE clerk_org_id = $1` → if exists, return; else create new row with `clerk_org_id = $1, owner_user_id = $userId`.
   - Else: legacy path (existing `ensureOrgForUser`).
3. **Backfill (one-time, run once after deploy):** for every user with an existing `organizations` row and no Clerk org, create a Clerk org via `clerkClient.organizations.createOrganization({ name: org.name, createdBy: userId })`, store its id back into `organizations.clerk_org_id`. Idempotent script in `scripts/backfill-clerk-orgs.ts`.
4. **Cutover:** ship the resolver behind a flag for one deploy → enable for new signups → backfill → flip default.

---

## Edge cases

- **Personal account with no active org:** `auth().orgId` is `undefined`. Fallback to legacy `owner_user_id` path. Keeps solo flow unchanged.
- **Cross-tab org switching:** Clerk session cookie reflects the active tab's org; existing server actions read `auth().orgId` per request, so they're naturally tab-correct. (Confirmed in Clerk docs.)
- **Encryption AAD:** field encryption uses `organizationId` as part of AAD (see [src/lib/assessment.ts](src/lib/assessment.ts#L65)). This keeps working unchanged because we're not changing `organizations.id` — only adding the `clerk_org_id` lookup column.
- **Admin pages:** `/admin` is per-Clerk-user (role flag in publicMetadata), not per-org. Leave untouched.
- **OAuth callbacks (M365, Google):** state token stores `userId`. Add `orgId` to the state JSON so the connector lands on the correct org. ~3 files.

---

## Out of scope (v1)

- Inviting team members into a managed business (could come later — it's free with Clerk).
- White-labeling the customer-facing PDF per MSP.
- Per-org SSO.
- Bulk operations across orgs ("send Charlie reminder to all clients with >3 gaps") — separate plan.
- Server-side `managed_orgs` enforcement (soft-nag only for v1).

---

## Why this is fast

- **Schema change:** one ALTER, one column.
- **Resolver:** one new function (~30 lines).
- **Server file edits:** ~50 files, but each is the same one-line change (`{ userId }` → `{ userId, orgId }`, pass both to resolver). Mechanical.
- **UI:** one new component (`<OrgSwitcher />`), drop into existing headers.
- **No row migrations.** No new tables. No new RLS. No connector changes (state token gets one extra field).

Estimated effort: **2 working days end-to-end**, including backfill script, Clerk plan setup, and a smoke-test pass.
