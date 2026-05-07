# Clerk Dashboard setup — MSP plans

This is the recipe to recreate in Clerk Dashboard → **Configure → Billing → Plans**, USER tab (subscription is on the user — the MSP — not on each managed organization).

---

## Market sizing (May 2026)

- **CyberAB Marketplace (March 2026):** ~5,732 active entries / 3,607 unique entities. Source: Secureframe analysis.
- **RPOs (Registered Provider Organizations) — the MSP/consulting category:** roughly ~1,000–1,400 globally, the vast majority US-based.
- **CMMC L1 universe (DoD's own estimate):** ~80,000 contractors must self-attest. Only ~12,000 had filed an accurate SPRS score by end of 2024. **~85% non-compliant and unserved.**
- **MSP client roster reality:** typical small MSP has 8–25 active clients across all industries; *DoD-only* clients per MSP averages 3–8 for general MSPs, 10–20 for defense-vertical specialists, and 20–30 for dedicated CMMC consultancies. Almost nobody runs >30 active CMMC L1 engagements at once — that becomes a head-count problem, not a software problem.

**Conclusion: capping at 10 / 20 / 30 covers ~95% of the realistic market and protects us from the one MSP who'd dump 100 clients in and crash the cost model on day one.**

---

## Plan definitions

Create four plans on the **User** subscription tab. Pricing is monthly base fee (no per-seat).

### 1. Self-Serve (existing — keep as-is)
- **Slug:** `cmmc_lv1_full_access` (already shipped as `user:cmmc_lv1_full_access`)
- **Monthly base fee:** $449
- **Feature:** `managed_orgs` = `1`
- **Description:** "One business. The original Custodia plan."
- **Publicly available:** yes
- **Free trial:** 14 days

### 2. MSP Starter
- **Slug:** `msp_starter`
- **Monthly base fee:** $799
- **Feature:** `managed_orgs` = `10`
- **Description:** "Manage up to 10 client businesses. ~$80/business at full capacity."
- **Publicly available:** yes
- **Free trial:** 14 days

### 3. MSP Growth (mark as recommended)
- **Slug:** `msp_growth`
- **Monthly base fee:** $1,499
- **Feature:** `managed_orgs` = `20`
- **Description:** "Manage up to 20 client businesses. ~$75/business at full capacity."
- **Publicly available:** yes
- **Free trial:** 14 days

### 4. MSP Scale
- **Slug:** `msp_scale`
- **Monthly base fee:** $1,999
- **Feature:** `managed_orgs` = `30`
- **Description:** "Manage up to 30 client businesses. ~$67/business at full capacity."
- **Publicly available:** yes
- **Free trial:** 14 days

> Anyone needing more than 30 emails `founders@custodia.com` for an enterprise quote. We deliberately do not offer an "unlimited" tier in v1 — keeps cost-per-business honest and forces a real conversation before someone tries to crash the system.

---

## Feature definition

Define ONE feature once, used across all plans:

- **Feature key:** `managed_orgs`
- **Type:** numeric limit
- **Description:** "Maximum number of CMMC L1 client businesses one Custodia user may manage simultaneously."

---

## v1 enforcement strategy

**Soft enforcement only.** The OrganizationSwitcher lets users create new businesses freely; the only check is a UX nag in the switcher dropdown when the user is at their plan's `managed_orgs` cap.

Why: server-side enforcement adds ~1 day of code (count active Clerk org memberships, gate the create flow, gate the resolver). Trust-the-customer is fine at this scale. We can layer enforcement later when we observe abuse.

**To add enforcement later (one function, server-side):**

```ts
// src/lib/billing/managed-orgs.ts
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function canManageMoreOrgs(): Promise<boolean> {
  const { userId, has } = await auth();
  if (!userId) return false;
  const limit = has({ feature: "managed_orgs" }) ? 999 : 1; // pseudo — actual API returns numeric
  const cc = await clerkClient();
  const memberships = await cc.users.getOrganizationMembershipList({ userId });
  return memberships.totalCount < limit;
}
```

Call from `OrgSwitcher` (client) and from any server action that creates a Clerk org.

---

## Pricing math sanity check

| Tier | Price | Cap | Per-business floor | Per-business at full cap |
|------|-------|-----|--------------------|--------------------------|
| Self-Serve | $449 | 1 | $449 | $449 |
| MSP Starter | $799 | 10 | — | $80 |
| MSP Growth | $1,499 | 20 | — | $75 |
| MSP Scale | $1,999 | 30 | — | $67 |

A typical MSP marks up Custodia 2–3× to their client (charges $200–$300/mo, pays us $75). At MSP Growth (20 clients × $250 retail = $5,000/mo gross), our $1,499 is ~30% of their CMMC L1 line revenue — defensible and sticky.

---

## After Clerk setup, test:

1. Create a test user → should default to Self-Serve plan tier behavior.
2. Sign up for MSP Growth → user can now create up to 20 Clerk orgs via the OrgSwitcher.
3. Switch active org → assessments page reads data scoped to that org (verify by creating different SSPs in two orgs).
4. Cross-tab: open two browser tabs on different orgs → each tab persists its own active org per Clerk docs.
