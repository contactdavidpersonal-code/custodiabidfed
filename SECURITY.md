# Security Posture — Custodia BidFed

Last reviewed: 2026-04-30. Reviewer: platform engineering.
Audience: founders, prospective primes, auditors, internal engineering.

## Scope

This document covers the **Custodia BidFed platform itself** (Next.js app on
Vercel + Neon Postgres + Vercel Blob + Clerk + Anthropic + Resend). It is
**not** a security plan for our customers' federal contractor environments —
that is what each customer produces inside the product as an SSP and SPRS
affirmation.

Custodia BidFed is U.S.-only. We do not market or knowingly serve users
outside the United States, so GDPR is out of scope. Our regulatory floor is
U.S. federal law, Pennsylvania state law (the home of our primary office),
and contractual obligations to small-business defense contractors using the
platform.

---

## 1. Architecture summary

| Concern | Implementation |
| --- | --- |
| Edge / runtime | Vercel Functions (Node.js runtime), TLS-terminated at Vercel edge |
| Authentication | Clerk (`@clerk/nextjs`) — handles password hashing, MFA, OAuth/SSO, session cookies |
| Authorization | Application-level: every authed entry point enforces `auth()` → `userId` → `getAssessmentForUser()` / `ensureOrgForUser()` tenant scope |
| Data store | Neon Postgres (TLS in transit, AES-256 at rest); all queries via Neon tagged-template parameterization |
| File storage | Vercel Blob (AES-256 at rest, TLS in transit). Blob URLs are unguessable (random suffix) and never cross the server/client trust boundary — clients always read through `/api/evidence/[id]` |
| LLM provider | Anthropic Claude (server-to-server). User-supplied content is treated as untrusted data; tools cannot escape the caller's tenant |
| Email | Resend (TLS) — transactional only |
| Cron | Vercel Cron — protected by shared `CRON_SECRET` bearer with constant-time compare |
| Secrets | Vercel encrypted env vars; validated at boot in `src/lib/security/env.ts` |
| Audit | Append-only `audit_log` table covering attestation, signing, evidence handling, exports, cron, auth, and rate-limit events |

---

## 2. OWASP Top 10 (2021) self-assessment

| # | Risk | Status | Notes |
| --- | --- | --- | --- |
| A01 | Broken Access Control | **PASS** | Every API/server-action call invokes Clerk `auth()` and then a tenant-scoped query. Evidence reads route through `/api/evidence/[id]` which re-checks tenant on every byte. AI tools are bound to `ctx.organizationId` derived server-side from `userId` — the LLM cannot pivot to another tenant. Cron routes use bearer-token auth with constant-time compare. |
| A02 | Cryptographic Failures | **PASS** | TLS end-to-end. AES-256 at rest on both Neon and Vercel Blob. Attestations signed with HMAC-SHA-256 over canonical-JSON payloads (`src/lib/security/attestation-signature.ts`). `keyVersion` field present on every signed payload to support future key rotation. |
| A03 | Injection | **PASS** | All SQL via Neon tagged templates (parameterized). All HTML rendered server-side passes through `esc()` which escapes `& < > " '`. Status enums are validated against allowlists before reaching SQL. No `eval`, no `new Function`, no `dangerouslySetInnerHTML` on user-supplied content (only on landing-page constants). |
| A04 | Insecure Design | **PASS w/ note** | Threat-modeled: prompt injection in user-uploaded evidence is hardened in `src/lib/ai/evidence-review.ts` (explicit untrusted-input boundary in the prompt; injection attempts are themselves grounds for `not_relevant`). LLM tool schemas are structured (`report_review`), not free-form. Attestation gating prevents premature signing on partial/no/unreviewed evidence. |
| A05 | Security Misconfiguration | **PASS w/ TODO** | HSTS preload, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy on every response (`next.config.ts`). **TODO:** add Content-Security-Policy after Clerk + Anthropic streaming + Vercel Blob compatibility verification. |
| A06 | Vulnerable & Outdated Components | **PASS** | `npm audit` run 2026-04-30: 5 moderate transitives, all inert in our usage (postcss in Next build, uuid in svix→resend with `buf` parameter we do not use). Anthropic SDK upgraded this commit to clear GHSA-p7fg-763f-g4gf. Recommend: enable Dependabot + GitHub code scanning. |
| A07 | Identification & Auth Failures | **PASS** | Clerk handles all credential storage, MFA, session management. App never sees plaintext passwords. Session cookies are HttpOnly, Secure, SameSite=Lax (Clerk defaults). |
| A08 | Software & Data Integrity Failures | **PASS** | `package-lock.json` committed. Attestations are HMAC-signed and the canonical payload is preserved in-row, so tampering is detectable years after sign-off. |
| A09 | Security Logging & Monitoring | **PASS** | `audit_log` table covers: attestation, signing, evidence upload/view/delete/MIME-rejection, bid-package & bid-packet export, cron unauthorized + executed, auth unauthorized, rate-limit exceeded. Every audit row carries IP + user agent. |
| A10 | SSRF | **PASS** | Three server-side fetches exist (`/api/evidence/[id]`, bid-package ZIP, evidence-review). All three operate on URLs read from our own DB, written by `@vercel/blob.put()`. No user-supplied URL is fetched. |

---

## 3. CMMC Level 1 — platform self-mapping

The platform is not itself a defense contractor handling FCI under a federal
contract, so CMMC L1 is not contractually binding on us. We map the 17
practices anyway so primes evaluating Custodia have a clean answer.

| # | Practice (FAR 52.204-21(b)(1)) | Status | How |
| --- | --- | --- | --- |
| 1 | AC.L1-3.1.1 — Limit system access to authorized users | ✓ | Clerk auth gate on every protected route + every server action. |
| 2 | AC.L1-3.1.2 — Limit transactions/functions to permitted | ✓ | Every action / tool / API call enforces tenant scope before mutating. |
| 3 | AC.L1-3.1.20 — Verify/control external connections | ✓ | Outbound only: Neon, Anthropic, Vercel Blob, Resend, SAM.gov. All TLS. No user-supplied egress. |
| 4 | AC.L1-3.1.22 — Control public-information posting | ✓ | Landing page is intentionally public; protected pages are auth-gated by middleware. |
| 5 | IA.L1-3.5.1 — Identify users, processes, devices | ✓ | Clerk `userId` on every authed request; every audit row records IP + UA. |
| 6 | IA.L1-3.5.2 — Authenticate users before access | ✓ | Clerk session cookie verification on every authed entry point. |
| 7 | MP.L1-3.8.3 — Sanitize/destroy media | N/A platform | Inherited from Vercel/Neon SOC 2 Type II. |
| 8 | PE.L1-3.10.1 — Limit physical access | N/A platform | Inherited from Vercel/Neon SOC 2. |
| 9 | PE.L1-3.10.3 — Escort visitors | N/A platform | Inherited. |
| 10 | PE.L1-3.10.4 — Audit logs of physical access | ✓ + inherited | App-layer `audit_log`; physical inherited. |
| 11 | PE.L1-3.10.5 — Control physical access devices | N/A platform | Inherited. |
| 12 | SC.L1-3.13.1 — Monitor/control comms at boundary | ✓ | Vercel edge enforces TLS; HSTS preload; rate limiting on chat/onboard/waitlist. |
| 13 | SC.L1-3.13.5 — Public-access subnetworks | ✓ | Application-layer separation — public landing vs. authenticated workspace. |
| 14 | SI.L1-3.14.1 — Identify/correct flaws timely | ✓ + TODO | `npm audit` clean of high/critical at this commit. **TODO:** enable Dependabot. |
| 15 | SI.L1-3.14.2 — Provide protection against malicious code | ✓ | MIME allowlist on uploads (executables, archives, scripts blocked); rejected uploads are audit-logged. |
| 16 | SI.L1-3.14.4 — Update protection mechanisms | ✓ | Vercel platform auto-patches; npm advisories monitored. |
| 17 | SI.L1-3.14.5 — Monitor security alerts/advisories | ✓ + TODO | npm audit run on each release. **TODO:** enable Dependabot + GitHub code scanning for continuous coverage. |

**12 of 17 directly implemented**, **5 inherited** from SOC 2 Type II
infrastructure (Vercel, Neon). A prime can be told: "we satisfy 12/17
CMMC L1 practices at the application layer; the remaining 5 are physical
practices and are inherited from our SOC 2 cloud providers."

---

## 4. Pennsylvania / Pittsburgh privacy & security obligations

### 4.1 PA Breach of Personal Information Notification Act (Act 94 of 2005, amended Act 151 of 2022)

Effective May 2023. Applies to any entity holding "personal information" of
PA residents.

**"Personal Information"** under the Act:
- Social Security number
- Driver's license / state ID number
- Financial account number with access code
- Medical or health insurance information
- Username/email + password or security question response sufficient to
  permit access to an online account

**What Custodia BidFed stores that triggers the Act:**
- User email (Clerk) + auth credentials (held by Clerk, not us)
- Org legal name, address, UEI, CAGE, NAICS — most of these are public-record
  contractor identity data, not "personal information" under the Act
- Evidence uploads — these *could* contain PII if a user uploads, e.g., a
  payroll screenshot to evidence AC.L1-3.1.1. We do not require it and we
  flag obviously-irrelevant artifacts via AI review.

**Encryption safe-harbor:** BPINA exempts encrypted data **unless** the
encryption key is also accessed. Both Vercel Blob and Neon Postgres use
AES-256 at rest with provider-managed keys; data in transit is TLS-only.
A breach that exposed only ciphertext without the key would not trigger
notification.

**Notification timing:** "Most expedient time possible and without
unreasonable delay," not exceeding **60 days** from discovery (absent
law-enforcement delay request). If >1,000 PA residents affected, the
three nationwide consumer reporting agencies must also be notified.
If >500 PA residents affected, the **PA Attorney General** must be
notified within 7 business days.

### 4.2 PA Data Security & Reasonable Security Procedures

PA case law and Act 151 require entities to maintain "reasonable security
procedures." Our implementation satisfies the commonly-cited prongs:

| Reasonable-security prong | Implementation |
| --- | --- |
| Access controls | Clerk auth + per-tenant row scoping; MFA available |
| Encryption at rest | AES-256 (Neon, Vercel Blob) |
| Encryption in transit | TLS 1.2+ enforced; HSTS preload |
| Audit logging | `audit_log` table; immutable append-only |
| Incident response | This document, §5 below |
| Vendor assessment | Vercel SOC 2 Type II, Neon SOC 2 Type II, Clerk SOC 2 Type II, Anthropic SOC 2 Type II |
| Employee training | Single-engineer founding team; documented secure-coding posture in this file |

### 4.3 Pennsylvania Privacy of Social Security Numbers Act (74 Pa.C.S. § 201)

Custodia BidFed **does not collect Social Security numbers**. Federal
contractor identity is captured via UEI + CAGE, both of which are public-record
identifiers issued by SAM.gov, not personal SSNs.

### 4.4 Pittsburgh-specific obligations

The City of Pittsburgh has no privacy or data-security ordinance comparable
to e.g. New York City's biometric-information law or California's CCPA.
Pittsburgh's Code of Ordinances regulates labor, paid sick days, and
non-discrimination, none of which create platform-level data-handling
obligations beyond PA state law. **No additional Pittsburgh-specific
controls are required.**

### 4.5 FTC Act § 5 (federal privacy floor)

Section 5 of the FTC Act prohibits "unfair or deceptive acts or practices."
Privacy promises must match actual behavior. **TODO:** publish a Privacy
Policy and Terms of Service covering data collected, retention, disclosure,
and the user's rights, and ensure the platform's actual behavior matches.

### 4.6 CAN-SPAM (federal email)

Outbound email is sent via Resend. **TODO:** audit transactional emails
(`src/lib/email/welcome.ts`) to confirm they include sender identification,
a valid postal address, and the user has opted in (transactional-class
email is generally exempt from opt-out, but the postal-address requirement
applies broadly).

---

## 5. Incident Response & Breach Notification Runbook

This is the runbook that satisfies PA BPINA's "reasonable IR procedure"
expectation and gives engineering a checklist if a breach is suspected.

### 5.1 Triggers

Any of the following starts the IR clock:
- Unauthorized cross-tenant access detected (audit row `auth.unauthorized` with `reason: "tenant_mismatch"` outside test traffic)
- Unexplained spike in `evidence.viewed` audit rows from a single user/IP
- Anomalous SQL errors suggesting injection probing
- Provider security advisory (Clerk, Vercel, Neon, Anthropic, Resend)
- Public disclosure of a vulnerability in a dependency we use
- User report of a security issue at `security@custodia.us` (TODO: stand up this address)

### 5.2 Containment (T+0 to T+1h)

1. Rotate any potentially-exposed secret immediately:
   - `CLERK_SECRET_KEY` — via Clerk dashboard
   - `DATABASE_URL` — Neon dashboard, then redeploy
   - `BLOB_READ_WRITE_TOKEN` — Vercel dashboard
   - `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `SAM_GOV_API_KEY` — provider dashboards
   - `CRON_SECRET`, `ATTESTATION_SIGNING_KEY` — generate fresh, redeploy. **Note:** rotating `ATTESTATION_SIGNING_KEY` invalidates re-verification of historical attestations under the new key — bump `CURRENT_ATTESTATION_KEY_VERSION` and add the old key to a key ring before rotating.
2. If active exploitation suspected: revoke affected user sessions in Clerk and disable the impacted Vercel deployment.
3. Snapshot the `audit_log` table and `evidence_artifacts` table to a secure offline store before any cleanup that might overwrite evidence.

### 5.3 Investigation (T+1h to T+24h)

1. Pull a forensic timeline from `audit_log` ordered by `created_at`. Filter on the affected `user_id` / `organization_id` / `ip`.
2. Cross-reference Vercel logs, Clerk session logs, and Neon query logs.
3. Verify Anthropic rate-limit logs for unusual tool-call patterns (potential prompt-injection that escaped guardrails).
4. Determine the categories of data potentially exposed:
   - Identity (email, name, org name, UEI, CAGE) — public-record-adjacent
   - Evidence files — potentially PII depending on what users uploaded
   - Attestation canonicals — non-PII but reputationally sensitive
   - Conversation history — could contain user-typed PII

### 5.4 Notification (T+24h to T+60 days)

If "personal information" as defined by PA BPINA was accessed by an unauthorized party AND the data was not encrypted (or the key was also accessed):

1. **Affected users:** notify by email within most-expedient-time, no later than 60 days post-discovery (absent law-enforcement delay).
2. **PA Attorney General:** if >500 PA residents affected, notify within **7 business days** via the OAG's online breach reporting form.
3. **Consumer reporting agencies:** if >1,000 residents affected (any state), notify Equifax, Experian, TransUnion.
4. **Other state AGs:** check the residency of affected users; many states have their own thresholds and content requirements (e.g., CA, NY, MA). Use a multistate breach-notification template.

Notification content must include: what happened, what data was affected, what we are doing about it, what the user should do, and a contact for follow-up.

### 5.5 Recovery & Post-Mortem (T+60 days+)

1. Patch the root cause; add a regression test or audit-log alert.
2. File a written post-mortem in `docs/postmortems/` with timeline, blast radius, fix, and prevention.
3. Re-run this security review and update the date at the top of this file.

### 5.6 Provider Status Pages

- Clerk — https://status.clerk.com
- Vercel — https://www.vercel-status.com
- Neon — https://neonstatus.com
- Anthropic — https://status.anthropic.com
- Resend — https://resend-status.com

---

## 6. Open Items / Roadmap

Tracked here as a single backlog so we don't lose them across reviews.

1. **Content-Security-Policy** — author and ship after end-to-end testing with Clerk + Anthropic streaming + Vercel Blob. Use Report-Only first.
2. **Dependabot + GitHub code scanning** — enable for continuous SI.L1-3.14.5 coverage.
3. **Privacy Policy & Terms of Service** — publish public-facing. Required for FTC Act § 5.
4. **`security@custodia.us` mailbox + security.txt** — establish coordinated-disclosure path.
5. **Legacy Vercel Blob URLs** — files uploaded before commit `4025fdc` use predictable URLs (without the random suffix). They are still served only through the authenticated `/api/evidence/[id]` proxy, so this is defense-in-depth-only. A one-time migration job (`SELECT blob_url; fetch; put({addRandomSuffix:true}); UPDATE; del`) is recommended but not blocking.
6. **Antivirus scanning of uploads** — current MIME allowlist refuses executables, scripts, and archives. For higher assurance (e.g., a CMMC L2 / DFARS 7012 customer cohort) integrate a malware scan post-upload.
7. **Annual third-party pentest** — schedule once paid customer count justifies it.

---

## 7. Coordinated Disclosure

If you discover a vulnerability in Custodia BidFed, please email
`security@custodia.us` (mailbox setup in flight per item 6.4 above). In the
meantime, contact `officers@custodia.us` and mark the subject line
`[SECURITY]`. Do not file public GitHub issues for security defects.

We do not currently run a formal bug bounty. We will acknowledge receipt
within 2 business days and aim to remediate or assign a fix window within
14 days for moderate issues and 7 days for high/critical issues.
