# Get Custodia on Google — submission + indexing checklist

**Owner:** founder
**Status:** ACTIVE — run sequentially the day of/after deploy

This is the operational checklist that turns the technical SEO wiring in
this repo (`robots.ts`, `sitemap.ts`, `llms.txt`, JSON-LD in `layout.tsx`
and `/blog/[slug]/page.tsx`) into actual Google crawls, AI Overview
citations, and ranked traffic.

Everything in here is **manual one-time setup** plus a **per-post drill**
to run on every publish.

---

## 0. Verify the wiring is live (5 min)

Once the deploy lands, hit these URLs from an incognito browser and
confirm they return the expected output. Anything 404 → fix before
moving on.

- https://bidfedcmmc.com/robots.txt — should list `Allow:` for `GPTBot`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`, `Applebot-Extended`, and ~12 others.
- https://bidfedcmmc.com/sitemap.xml — should include all 10 blog posts + 14 marketing pages + any `/verified/*` slugs.
- https://bidfedcmmc.com/llms.txt — should match `public/llms.txt` (pricing $149/$297, all 10 blog slugs).
- View source on https://bidfedcmmc.com/ — should contain two `<script type="application/ld+json">` blocks (Organization + WebSite/SearchAction).
- View source on https://bidfedcmmc.com/blog/do-i-need-cmmc-decision-tree — should contain three JSON-LD blocks (Article + BreadcrumbList + FAQPage).

Use the Rich Results Test (https://search.google.com/test/rich-results)
on each Tier-0 blog post URL. It must report `Article` and `FAQPage`
both valid, zero errors.

---

## 1. Google Search Console (one-time, 15 min)

1. Visit https://search.google.com/search-console and add `https://bidfedcmmc.com` as a **Domain property** (not URL prefix — domain catches `www`, subdomains, both protocols).
2. Verify via DNS TXT record at the registrar. (Easiest.)
3. After verification, set the `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env var on Vercel to the meta-tag value as a belt-and-suspenders fallback, redeploy.
4. In Search Console:
   - **Sitemaps** → submit `https://bidfedcmmc.com/sitemap.xml`.
   - **URL Inspection** → paste the homepage URL → "Request indexing".
   - Repeat URL Inspection + "Request indexing" for the **5 highest-priority blog posts** (Tier-0 + Tier-1):
     - `/blog/do-i-need-cmmc-decision-tree`
     - `/blog/cmmc-level-1-vs-level-2`
     - `/blog/what-is-fci-federal-contract-information`
     - `/blog/cmmc-level-1-17-practices-explained`
     - `/blog/sprs-score-explained-and-how-to-respond-to-prime`
5. Check **Settings → Crawl stats** the next day. You should see Googlebot crawling and the sitemap status as "Success".

> **Quota note:** Search Console caps "Request indexing" at ~10/day. Don't burn it. Use IndexNow (step 3) for the bulk path.

---

## 2. Bing Webmaster Tools (one-time, 10 min)

1. Visit https://www.bing.com/webmasters → Add site `https://bidfedcmmc.com`.
2. Verify via DNS, or import directly from Search Console (Bing supports a one-click GSC import that copies your verified property over).
3. Set the `NEXT_PUBLIC_BING_SITE_VERIFICATION` env var on Vercel if you went the meta-tag route, redeploy.
4. Submit the sitemap.
5. Bing Webmaster pulls in IndexNow automatically once it's configured (step 3), so you don't need to do anything else here.

ChatGPT search, Perplexity, and Copilot all sit on top of the Bing index
— **getting Bing right is the AI-Overview/AI-citation play.**

---

## 3. IndexNow — instant crawl pings to Bing/Yandex/Naver (one-time + per-deploy)

This is implemented at `src/app/api/indexnow/route.ts`.

### One-time setup

1. Generate a 32-char hex key:
   ```pwsh
   [Convert]::ToHexString((1..16 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ })).ToLower()
   ```
2. Save the key as the env var `INDEXNOW_KEY` on Vercel (Production + Preview).
3. Create `public/<INDEXNOW_KEY>.txt` containing exactly the key string (no quotes, no newline). Commit. (You can also serve this dynamically from a route handler if you'd rather not commit the key — the IndexNow protocol just requires the URL `https://bidfedcmmc.com/<key>.txt` returns the key.)
4. Confirm `CRON_SECRET` is set (the route requires `Authorization: Bearer $CRON_SECRET`).

### Per-deploy ping

After every deploy that touches public content:

```pwsh
curl -X POST https://bidfedcmmc.com/api/indexnow `
  -H "Authorization: Bearer $env:CRON_SECRET"
```

Returns `{ submitted: N, ok: true, status: 200, ... }` on success. Wire
this into your Vercel deploy hook (Settings → Git → Deploy Hooks) or
into the GitHub Actions `deploy` job.

---

## 4. Per-new-post drill (run every time you publish)

1. Add the post to `src/lib/blog.ts` POSTS array and create the `.tsx` file under `src/app/blog/posts/`.
2. Ensure `meta` includes: `slug`, `description` (≤160 char), `keywords` (5–8), `datePublished`, `dateModified`, `author`, and `faq` (3–5 entries minimum — this is the AI-extraction surface).
3. Deploy.
4. Test the new post with Rich Results Test — confirm Article + FAQPage both validate.
5. Hit `POST /api/indexnow` to broadcast to Bing/Yandex/Naver.
6. In Google Search Console → URL Inspection → paste the new URL → "Request indexing".
7. Add a one-line link to `public/llms.txt` so AI crawlers see it in the curated index.
8. Cross-link the new post from at least 2 existing posts (internal link equity).

---

## 5. Off-platform citations (ongoing, build over weeks)

These are the external signals that take a blog from "indexed" to
"ranked". Pick 2 per week.

- **r/govcon, r/cybersecurity, r/smallbusiness** — answer real CMMC L1 questions, link to the specific post that answers it. No spam, no self-promo posts. Use a real Custodia officer account.
- **LinkedIn** — repost each blog's TL;DR as a native LinkedIn post. The page is already created (`/company/bidfedcmmc`); pin a foundational post.
- **Cyber AB Marketplace** — apply for an ecosystem listing as a tool/platform.
- **HARO / Qwoted / Featured.com** — answer "CMMC for small business" reporter queries with one-paragraph quotes that link back.
- **GovCon Wire / Federal News Network / Washington Technology** — pitch one guest column per quarter.
- **Cite a primary source, get cited back** — every time you add a new regulatory citation in a post, file an issue on the Wikipedia CMMC article to suggest the post as a secondary-source reference (neutral phrasing, no first-person).

---

## 6. Verification you're getting it (check weekly)

- Search Console → Performance → filter by query: `cmmc level 1`, `sprs score`, `what is fci`. Look for impressions climbing.
- Search Console → Pages → confirm "Indexed" count climbing toward total sitemap URL count.
- `site:bidfedcmmc.com` in Google — confirm all 10 posts present.
- `site:bidfedcmmc.com` in Bing — same.
- Test the AI Overview surface: search `do I need cmmc` on Google; look for any AI Overview citation. (Takes 4–8 weeks typically after indexing.)
- Perplexity: search `what is FCI cmmc level 1`; check if any answer cites bidfedcmmc.com.

---

## 7. Things that will silently kill rankings — don't do these

- **Don't change a slug after publish.** If you must, add a 301 in `next.config.ts` redirects.
- **Don't drop `dateModified`.** Quarterly refresh of Tier-0/Tier-1 posts bumps it; AI crawlers heavily weight freshness for regulatory topics.
- **Don't gate blog content behind auth.** All blog routes must remain 200 to anonymous crawlers.
- **Don't block AI crawlers globally.** The `robots.ts` explicit `allow` per-bot pattern is intentional — keep it.
- **Don't ship blog posts that don't have `faq` populated.** That's where the AI Overview citations come from.

---

## Environment variable summary (Vercel → Settings → Environment Variables)

| Var | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical site URL (no trailing slash). | Yes |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console meta-tag value. | Optional (DNS works too) |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | Bing Webmaster meta-tag value. | Optional (DNS works too) |
| `INDEXNOW_KEY` | 32-char hex key for IndexNow ownership proof. | For IndexNow only |
| `CRON_SECRET` | Bearer token guarding the IndexNow route. | Yes (already set) |
