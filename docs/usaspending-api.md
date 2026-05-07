# USAspending API — Agent Reference (BidFed)

> Purpose: this document is the **single source of truth** for any agent
> writing code that talks to USAspending in this repo. It is opinionated
> toward our use case (cold-outbound discovery for awarded DoD prime
> contractors) — not a complete API reference. When in doubt, read the
> upstream contracts under
> https://github.com/fedspendingtransparency/usaspending-api/tree/master/usaspending_api/api_contracts/contracts/v2
> rather than guessing.

---

## TL;DR for agents

- **Base URL:** `https://api.usaspending.gov`
- **Auth:** none. No API key, no header. Do **not** add `Authorization`.
- **Rate limit:** undocumented but real. Treat as **~5 req/sec sustained**.
  Add jitter + backoff on 429/5xx. Never parallelize > 4.
- **Default workhorse endpoint:** `POST /api/v2/search/spending_by_award/`
- **Date format:** ISO `YYYY-MM-DD` everywhere.
- **Money fields:** raw numbers in USD, not strings.
- **UEI vs DUNS:** UEI is the only durable identifier post-2022.
  DUNS fields are kept for historical rows but are deprecated. Use UEI.
- **`generated_internal_id`:** the opaque award identifier. It's what
  `/api/v2/awards/<AWARD_ID>/` expects, not the human-readable `Award ID`
  (PIID/FAIN). Persist `generated_internal_id` as the primary key when
  caching awards.
- **Pagination:** `page` (1-indexed) + `limit` (max 100). Response includes
  `page_metadata.hasNext`. Stop when false.
- **Spec drift:** USAspending breaks contracts occasionally. Always parse
  defensively (treat all response fields except those in the canonical
  `SpendingByAwardResponse` as nullable).

---

## When to use which endpoint

For our outbound pipeline, only three endpoints matter. Everything else is
out of scope for this document.

| Need                                                       | Endpoint                                                      | Method |
|------------------------------------------------------------|---------------------------------------------------------------|--------|
| Find recently awarded DoD prime contractors (the funnel)   | `/api/v2/search/spending_by_award/`                           | POST   |
| Get full award detail for one award                        | `/api/v2/awards/<generated_internal_id>/`                     | GET    |
| Look up a recipient by UEI (returns parent + children)     | `/api/v2/recipient/duns/` then `/api/v2/recipient/<HASH>/`    | POST/GET |

If an agent reaches for `/api/v2/bulk_download/awards/` or
`/api/v2/download/*`, stop and reconsider. Bulk download generates async
zip files — wrong shape for incremental discovery. Use the search endpoint
with date windows.

---

## Endpoint 1: spending_by_award (the discovery query)

`POST https://api.usaspending.gov/api/v2/search/spending_by_award/`

### Canonical BidFed request — recently awarded DoD prime contracts

```json
{
  "subawards": false,
  "limit": 100,
  "page": 1,
  "sort": "Action Date",
  "order": "desc",
  "filters": {
    "time_period": [
      { "start_date": "2026-04-01", "end_date": "2026-04-30" }
    ],
    "award_type_codes": ["A", "B", "C", "D"],
    "agencies": [
      { "type": "awarding", "tier": "toptier", "name": "Department of Defense" }
    ],
    "award_amounts": [
      { "lower_bound": 100000, "upper_bound": 10000000 }
    ]
  },
  "fields": [
    "Award ID",
    "Recipient Name",
    "Recipient UEI",
    "Start Date",
    "End Date",
    "Award Amount",
    "Awarding Agency",
    "Awarding Sub Agency",
    "Contract Award Type",
    "NAICS",
    "PSC",
    "Description",
    "Place of Performance State Code",
    "recipient_id",
    "generated_internal_id"
  ]
}
```

### Field cheat sheet

- `award_type_codes`:
  - `A` = BPA Call, `B` = Purchase Order, `C` = Delivery Order,
    `D` = Definitive Contract — together these are "prime contracts."
  - Avoid `IDV_*` for our funnel (those are vehicles, not the executable awards).
  - For grants/loans (irrelevant for CMMC outbound), see upstream docs.
- `agencies[].name` must match the **exact** toptier name. The string
  `"Department of Defense"` covers Army/Navy/AF/USMC/Space Force/etc. via
  subtiers. To narrow to one branch, set `tier: "subtier"` and use the
  subtier name (e.g., `"Department of the Army"`).
- `award_amounts`: a **list** of bands, OR'd together. Use one band for
  ICP filtering. Default `lower_bound: 100000` excludes micro-purchases;
  raise to `1_000_000` if quality > volume.
- `naics_codes.require` / `.exclude`: pass NAICS prefixes (e.g. `["33"]`
  for manufacturing). USAspending does **prefix matching**.
- `time_period[].start_date` / `.end_date`: inclusive on both ends.
  This filters on **action date**, not period of performance.
- `recipient_search_text`: full-text across name + UEI + DUNS. Useful
  for de-duping or company-specific lookups; **not** for ICP filtering.
- `place_of_performance_scope: "domestic"`: drop foreign awards. Use it.

### Response shape (the fields you'll actually read)

```json
{
  "results": [
    {
      "internal_id": 12345678,
      "Award ID": "W912DY-26-D-0042",
      "generated_internal_id": "CONT_AWD_W912DY26D0042_9700_-NONE-_-NONE-",
      "Recipient Name": "ACME DEFENSE LLC",
      "Recipient UEI": "ABC123XYZ456",
      "recipient_id": "abc-hash-L",
      "Awarding Agency": "Department of Defense",
      "Awarding Sub Agency": "Department of the Army",
      "Award Amount": 542000,
      "Start Date": "2026-04-15",
      "End Date": "2027-04-14",
      "NAICS": "541512",
      "PSC": "D399",
      "Contract Award Type": "DEFINITIVE CONTRACT",
      "Description": "IT SERVICES — ENTERPRISE NETWORK SUPPORT",
      "Place of Performance State Code": "VA"
    }
  ],
  "page_metadata": { "page": 1, "hasNext": true },
  "limit": 100,
  "messages": []
}
```

Treat **every** field except `internal_id` and `generated_internal_id`
as nullable. The response shape changes; defensive parsing is mandatory.

### Pagination contract

- Start at `page: 1`, `limit: 100`.
- Loop while `page_metadata.hasNext === true`.
- Cap iteration at `MAX_PAGES` (recommend 50 → 5,000 awards). If you hit
  the cap, narrow the time window or NAICS filter — don't keep paginating.

---

## Endpoint 2: award detail

`GET https://api.usaspending.gov/api/v2/awards/<generated_internal_id>/`

Use only when you need fields not exposed by `spending_by_award`:
- Place of performance ZIP+4 (we use state code only — usually skip)
- Parent award (the IDV under which a delivery order was issued)
- Funding agency (the customer who paid; sometimes ≠ awarding agency)
- Latest action date / modification history

For our outbound flow, **we usually don't need this call.** Only fetch
detail if the prospect's first response asks something specific about
the award. Otherwise it's wasted budget against the implicit rate limit.

URL-encode the `generated_internal_id`. The `_-NONE-_` segments contain
dashes that look fine but trip naive concatenation.

---

## Endpoint 3: recipient profile

```
POST /api/v2/recipient/duns/         # search by name/UEI text
GET  /api/v2/recipient/<HASH_VALUE>/ # full profile
```

`recipient_id` from `spending_by_award` is `<hash>-L` (Letter for level —
`R`=recipient, `P`=parent, `C`=child). The recipient endpoint expects the
`<hash>` portion, level included.

Use only when:
- We need to know if the awardee is a **parent** with subsidiaries (so we
  can target the operating company, not the holding company).
- We need historical award totals for talk-track personalization
  ("you've won $4.2M from DoD over the last 3 years").

For pure list-building, skip this — `spending_by_award` already gives us
name + UEI which is what Hunter needs.

---

## Robust client patterns (mandatory for our pipeline)

### 1. Timeouts

USAspending occasionally hangs for 30+ seconds. Always set:

```ts
signal: AbortSignal.timeout(20_000)
```

### 2. Retry on 429 / 5xx

```
attempt 1: immediate
attempt 2: +1s
attempt 3: +3s
attempt 4: +9s
fail
```

Do **not** retry on 4xx (except 429). A 400 means our filter object is
malformed — log the request body and fix the code.

### 3. Idempotency

Discovery is run nightly. Use `generated_internal_id` as the primary key
in our `outbound_prospects` table. Re-running the same time window must
not duplicate rows.

### 4. Time window strategy

Don't query "last 30 days" every night. Query by **action date day**:

- Cron at 03:00 UTC pulls `start_date = end_date = $YESTERDAY`.
- Backfill is a one-shot script that walks day-by-day.

This bounds memory, makes failures resumable, and prevents accidental
re-pull of the same awards if upstream backdates a row.

### 5. Defensive parsing

```ts
type AwardRow = {
  internal_id: number;
  generated_internal_id: string;
  recipientName: string | null;
  recipientUei: string | null;
  awardAmount: number | null;
  // ...
};

function parseAward(row: unknown): AwardRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.generated_internal_id !== "string") return null;
  // ...
}
```

Never type the response as the upstream Apiary schema literally. They
ship breaking changes without notice.

---

## What this API does NOT give you

These are NOT in `spending_by_award` responses. Don't try:

- ❌ Email addresses (Hunter)
- ❌ Phone numbers (apollo, ZoomInfo, or scrape)
- ❌ Company website / domain (we infer from name → Hunter domain search)
- ❌ Headcount, industry beyond NAICS, funding stage (Apollo / Crunchbase)
- ❌ Whether they handle FCI vs CUI (that's our Sales Charlie's job)
- ❌ Real-time / hour-fresh data (USAspending lags ~1 day on contracts)

If an agent finds itself needing one of these from USAspending, stop and
ask the human — it doesn't exist in this API.

---

## Privacy and ToS notes

- USAspending data is **public US Government data** (Federal Funding
  Accountability and Transparency Act). Use freely.
- The companies surfaced are public award recipients. Their names are
  public. Reaching out to them via cold email is legal but governed by
  CAN-SPAM and (if applicable) state laws — that's an Instantly /
  copywriting concern, not a USAspending concern.
- Do **not** put USAspending data behind our paywall as "exclusive" data.
  It isn't. We add value via the CMMC diagnostic, not via the award list.

---

## File map for this integration

When implementing, place files here:

```
src/lib/outbound/
  usaspending.ts          # Typed client + parseAward() + iteratePages()
  usaspending.test.ts     # Optional, against recorded fixtures
  prospects.ts            # DB layer (insert/upsert by generated_internal_id)
  pipeline.ts             # discover() — orchestrates Hunter + USAspending

src/app/api/cron/
  discover/route.ts       # GET, gated by CRON_SECRET, runs once/day

src/app/api/outbound/
  hunter-test/route.ts    # already exists — admin-gated smoke test
  usaspending-test/route.ts  # similar smoke test for usaspending
```

Match the existing repo patterns:
- `runtime = "nodejs"`
- Lazy DDL via `_tableReady` promise cache (see `src/lib/cmmc-check/store.ts`)
- Rate-limited admin endpoints behind `OUTBOUND_ADMIN_SECRET`
- Cron endpoints behind `CRON_SECRET` from `validateEnvOnce()`

---

## Quick verification recipe

To prove the API works without writing any code:

```powershell
$body = @'
{
  "subawards": false,
  "limit": 3,
  "filters": {
    "time_period": [{"start_date": "2026-04-01", "end_date": "2026-04-30"}],
    "award_type_codes": ["A","B","C","D"],
    "agencies": [{"type":"awarding","tier":"toptier","name":"Department of Defense"}]
  },
  "fields": ["Award ID","Recipient Name","Recipient UEI","Award Amount","NAICS","Description"]
}
'@

curl.exe -s -X POST "https://api.usaspending.gov/api/v2/search/spending_by_award/" `
  -H "Content-Type: application/json" `
  --data-raw $body | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

Expected: 3 results with DoD recipients. No auth headers required.

---

## Upstream references (read these if you need more depth)

- Endpoint index: https://api.usaspending.gov/docs/endpoints
- Search filter spec:
  https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/search_filters.md
- spending_by_award contract:
  https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/search/spending_by_award.md
- Award detail contract:
  https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/awards/awards.md
- Recipient contract:
  https://github.com/fedspendingtransparency/usaspending-api/tree/master/usaspending_api/api_contracts/contracts/v2/recipient

---

_Last verified against upstream: 2026-05. If you're reading this >6
months later, sanity-check `spending_by_award` request body against
upstream — they have shipped breaking changes before._
