# Cold Email Sequence v1 — BidFed CMMC

**Status:** DRAFT — not yet pasted into Instantly. Awaiting founder sign-off.

**Sender:** David Fuentes — Compliance Officer, Custodia
**Reply-to:** sending mailbox (rotates across 10)
**Signature:** identical across all 10 mailboxes (David Fuentes / Compliance Officer / Custodia)
**Single CTA:** `https://bidfedcmmc.com/cmmc-check`
**Volume:** 3/day per mailbox × 10 mailboxes = **30/day total** (post-warmup)
**Cadence:** Day 0 → Day 4 → Day 9 (then stop)

---

## Voice rules (Rhetorich-inspired)

- Sharp, declarative. Founder-direct.
- One idea per email.
- 1-3 sentence paragraphs. Heavy whitespace.
- No "I hope this finds you well." No "Just following up." No "circling back."
- No award personalization. No company-specific hooks. Generic enough to send to any DoD-adjacent SMB.
- One link, one CTA. Bare URL.
- Sale + free-trial mentioned in **every** email but never the lead.

---

## Variables

Instantly merge fields used:
- `{{firstName}}` — recipient first name (Hunter-supplied)
- `{{companyName}}` — recipient company (Hunter-supplied)

Fallback strategy: if either is empty, the email is **skipped** (no "Hi there" leakage).

---

## Email 1 — Day 0 — "Cyber threat angle"

**Subject A:** quick CMMC question, {{firstName}}
**Subject B:** {{companyName}} + CMMC Level 1
**Subject C:** the 15 controls keeping {{companyName}} eligible

**Body:**

Hi {{firstName}},

CMMC Level 1 self-assessments are now a hard requirement on every new DoD prime and sub contract — not a future thing, a today thing.

Most {{companyName}}-sized shops we talk to are one phishing email away from losing their eligibility. The 15 FAR 52.204-21 safeguarding requirements aren't hard. They're just nobody's full-time job.

I'm a compliance officer at Custodia. We built a 5-minute conversation that tells you, plainly, whether you need Level 1 and what's missing — no signup, no credit card:

https://bidfedcmmc.com/cmmc-check

If it says you have gaps, we have a 14-day free trial (no card) running through Sept 30 that closes them for you. If it says you're fine, you're fine.

David Fuentes
Compliance Officer, Custodia
bidfedcmmc.com

---

## Email 1 (alt) — Day 0 — "Deadline reality angle"

**Subject A:** CMMC Phase 1 — where {{companyName}} stands
**Subject B:** {{firstName}}, 5-minute self-check
**Subject C:** is {{companyName}} on the hook for CMMC?

**Body:**

Hi {{firstName}},

The 32 CFR Part 170 rule went live in late 2024. The DFARS contract clause (252.204-7021) is now landing on new DoD solicitations on a rolling basis through 2028.

Translation: any new DoD work {{companyName}} bids on is increasingly likely to require an annual CMMC Level 1 self-assessment in SPRS, signed by a senior official, before award.

I'm a compliance officer at Custodia. Five-minute chat with our AI tells you, plainly, whether you need Level 1 today — no signup:

https://bidfedcmmc.com/cmmc-check

If you do, our platform walks you through it — 14 days free, no credit card, sale runs through fiscal year end Sept 30.

David Fuentes
Compliance Officer, Custodia
bidfedcmmc.com

---

## Email 2 — Day 4 — "What Level 1 actually is" (educational follow-up)

**Subject:** re: CMMC Level 1 — the 15 requirements

**Body:**

{{firstName}},

Quick context in case the first email was buried.

Level 1 is the lowest CMMC tier. It covers Federal Contract Information — basically anything the DoD shares with you that isn't public. 15 safeguarding requirements (FAR 52.204-21(b)(1)). Annual self-assessment. Senior official signs it in SPRS.

It is not a 6-month consulting engagement. It's a checklist. The hard part is just doing it consistently and having the artifacts when an auditor asks.

Five minutes to find out where {{companyName}} stands:

https://bidfedcmmc.com/cmmc-check

David
Custodia

---

## Email 2 (alt) — Day 4 — "Cost of doing nothing"

**Subject:** re: CMMC Level 1 — what it costs to skip it

**Body:**

{{firstName}},

If {{companyName}} skips the self-assessment, three things happen:

1. New DoD contracts get rejected at the eligibility check.
2. Existing contracts get flagged on the next mod.
3. A False Claims Act suit becomes a real risk if you signed and weren't compliant.

None of these are theoretical anymore — DOJ's Civil Cyber-Fraud Initiative has been settling cases since 2022.

Five-minute self-check:

https://bidfedcmmc.com/cmmc-check

David
Custodia

---

## Email 3 — Day 9 — "Final touch / breakup"

**Subject:** last note from me, {{firstName}}

**Body:**

{{firstName}} — I won't keep emailing.

If CMMC isn't on {{companyName}}'s radar yet, the free check is here whenever you want it. No signup, no card:

https://bidfedcmmc.com/cmmc-check

The 14-day free trial offer ends with the fiscal year (Sept 30). After that, full price.

David Fuentes
Compliance Officer, Custodia

---

## Send-time logic (configured in Instantly campaign)

- **Days:** Tue / Wed / Thu only
- **Time window:** 9:30 AM – 11:30 AM recipient local time
- **Daily cap:** 3 per mailbox
- **Throttle:** 1 email every 8-15 min (random jitter)
- **Reply detection:** any reply pauses the sequence for that lead
- **Open/click tracking:** OFF (hurts deliverability for cold email in 2026; we measure replies + form fills only)

---

## Compliance footer (REQUIRED — paste into Instantly campaign settings)

Custodia / BidFed CMMC · [physical address] · You're receiving this because we believe {{companyName}} may be subject to DoD CMMC requirements. Reply STOP and I'll remove you immediately.

> ⚠️ Need a real physical address before activation. CAN-SPAM requires a postal address on every commercial email. Use your registered business address, a USPS PO Box, or a virtual mailbox (e.g., Anytime Mailbox ~$10/mo).

---

## Pre-flight checklist (don't activate campaign until ALL checked)

- [ ] All 10 Instantly accounts show **Connected** + **Warming up**
- [ ] Day 14+ from warmup start (target: **May 21, 2026** earliest)
- [ ] `bidfedcmmc.com/cmmc-check` is live in production and Charlie responds
- [ ] Physical address added to compliance footer above
- [ ] Founder has read every email out loud and approved
- [ ] Hunter → USAspending → Instantly leads pipeline is built (separate task)
- [ ] Test send: campaign sends to a personal inbox first, lands in primary tab (not spam/promo)
