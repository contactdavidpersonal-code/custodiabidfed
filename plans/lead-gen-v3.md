# Lead-Gen v3 — CMMC-L1 Discovery Agent

**Goal:** 10 qualified leads per run × 3 runs/day = 30 emails/day pipeline.

## What is a CMMC L1 lead?

CMMC Level 1 applies to **any DoD prime or sub that handles Federal Contract Information (FCI)**. That's basically every company that gets a DoD contract larger than the micro-purchase threshold ($10k). The compliance is mandatory but light (15 controls, self-attested).

So the question isn't "do they need CMMC L1?" — they almost all do. The question is:
**"Do they need CMMC L1 *and* not have it figured out yet?"**

That filters out:
- Megaprimes (Lockheed, Northrop, Raytheon, etc.) — they have entire compliance departments
- Public engineering firms ($1B+ rev like AECOM, Tetra Tech, Jacobs, HDR, ICF, Parsons) — same
- Big consulting (Booz Allen, Deloitte, Accenture, SAIC, CACI) — same
- Big tech federal arms (AWS, Microsoft Federal, Oracle Federal) — same
- Universities, FFRDCs (MITRE, RAND, JHU APL), federal labs
- Joint ventures (almost always megaprime + megaprime)
- Foreign primes

That leaves: **small US companies that just won DoD work.** Our ICP.

## ICP signals (in priority order)

1. **US small business** — best signal we have access to: `recipient_type_names` includes "small_business" (USAspending exposes this filter).
2. **DoD prime award in last 90 days** — fresh = urgent.
3. **Award amount $25k–$10M** — above $10k = CMMC L1 required; above $10M = probably already big.
4. **Plausible FCI-handling NAICS** — engineering, IT, R&D, defense electronics, manufacturing.
5. **Not a known megaprime by name** — short hard-coded blacklist of ~25 companies.
6. **Has a findable website domain** — Hunter needs this to enrich.

## Pipeline (3 stages)

```
USAspending search
   │
   ▼
 Stage 1: Rule filter (cheap, deterministic)
   • drop megaprimes by name (~25 patterns, not 80)
   • drop universities, FFRDCs, govt entities, JVs
   • drop non-US states
   • drop awards <$25k or >$10M
   • require small_business recipient flag (when present)
   │  pass-rate target: ~50% of awards
   ▼
 Stage 2: Claude review (one batched call, ~30 candidates)
   • prompt: "would this company need CMMC L1 *and* probably not have it?"
   • output: keep/skip + aiScore + one-sentence reasoning
   • picks top N (configurable, default 10)
   │
   ▼
 Stage 3: Hunter enrichment (one call per kept lead)
   • domainSearch by company name → domain + emails
   • bestContactForDomain → top exec email
   • persist to prospect_contacts (email, title, confidence, verification)
   │  hunter cost: ~10 calls/run × 3 runs/day = 30 calls/day << 500/mo budget
   ▼
 prospects + prospect_contacts written
```

## USAspending API tweaks

- **Filter:** `recipient_type_names: ["small_business"]` — major signal, costs nothing.
- **Date window:** 90 days back (was 60).
- **Amount band:** $25k–$10M (was $100k–$25M).
- **Pages:** up to 10 (was 5) — more raw material.
- **NAICS:** keep current 27.

## Stage-1 rule changes

- Trim `REJECT_NAME_PATTERNS` from 80 → ~25. Only the *truly* impossible-fits.
- Drop the "Tier-A vs Tier-B NAICS" scoring — let Claude judge nuance.
- Drop the recency bonus — let Claude weight it.
- Hard-rejects only:
  - name matches blacklist
  - `JOINT VENTURE` or ` JV ` token
  - state not in US set
  - amount <$25k or >$10M
  - missing recipient name

That gets us to ~30 survivors per page of 100 awards. Plenty for Claude.

## Stage-2 Claude prompt rewrite

Reframe around "needs L1 *and* doesn't have it." Anchor with explicit good/bad examples. Lower threshold to keep more — we want 10 keeps from ~30 candidates, not 1 from 16.

## Stage-3 Hunter

Re-enable. One `domainSearch` + one `bestContactForDomain` per kept lead. Persist to `prospect_contacts`. Don't burn `verifier` credits yet — confidence ≥80 from Hunter is good enough to start.

## Backfill

```sql
UPDATE prospects
SET status = 'reviewing'
WHERE status = 'approved' AND ai_reviewed_at IS NULL;
```

Demote v1 ghosts (Tetra Tech / CDM / HDR) so they stop appearing as approved.

## Success criteria

- Run produces ≥8 keeps with ≥6 having Hunter contacts attached
- Token cost ≤$0.02/run
- Hunter cost ≤15 calls/run
- No megaprimes, universities, or JVs in keeps
- Reasoning column reads sensibly per row
