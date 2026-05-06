# AWS KMS Migration Guide — Custodia BidFed

> **Status:** Planning doc. Not yet implemented. Today the platform KEK
> lives in a Vercel env var (`FIELD_ENCRYPTION_KEY`). This file describes
> the upgrade path to put the KEK behind AWS KMS so the key bytes can be
> *used* but never *exfiltrated*.

---

## Why this matters

**Current threat model (Tier 2):** an attacker who gets both your Vercel
project access *and* a database dump can decrypt user data. The Vercel
env var is the single weakest link — anything that runs inside a Vercel
serverless function can read `process.env.FIELD_ENCRYPTION_KEY`.

**With KMS (Tier 3):** the KEK never leaves AWS. The application sends
*ciphertext* to KMS and gets *plaintext* back (or the reverse). To steal
the key, an attacker has to compromise the AWS account itself — a much
narrower and better-monitored attack surface than "anything that runs in
your Vercel function".

For FCI, this collapses your residual risk from "two systems" (Vercel +
DB) to "three systems" (AWS IAM + Vercel + DB).

---

## Architecture

```
                    AWS account (us-east-1)
                    ┌──────────────────────────┐
                    │  KMS CMK                 │
                    │  alias/custodia-kek-prod │
                    │  (AES-256, 365-day      │
                    │   automatic rotation)    │
                    └────────────▲─────────────┘
                                 │ Decrypt / Encrypt
                                 │ (IAM-scoped to one role)
              ┌──────────────────┴──────────────────┐
              │                                     │
   ┌──────────┴──────────┐               ┌──────────┴──────────┐
   │ Vercel function     │               │ Local admin tooling │
   │ (KMS data-key cache │               │ (rotate / shred)    │
   │  in-memory, 5 min)  │               │                     │
   └─────────────────────┘               └─────────────────────┘
```

**Key hierarchy unchanged.** KMS replaces `loadKek()` only.

```
Today                              After KMS
─────                              ─────────
KEK = env var                      KEK = KMS CMK (never leaves AWS)
DEK = wrapped under KEK            DEK = wrapped under a KMS data key,
                                         which is wrapped under the CMK
```

We use **envelope encryption with KMS data keys**, not raw KMS
encrypt/decrypt. KMS issues a short-lived symmetric data key (256-bit),
returns it both encrypted (ciphertext blob) and plaintext (in-memory
only). The plaintext data key wraps DEKs for ~5 minutes, then is wiped
from memory. Every cold start fetches a fresh data key. This keeps
KMS API call volume low (and cost predictable) while preserving the
"key never persists outside KMS" property.

---

## Cost analysis

### Pricing (us-east-1, May 2026 — verify current rates before commit)

| Item                              | Rate                                |
| --------------------------------- | ----------------------------------- |
| Customer-managed key (CMK)        | $1.00 / month per key               |
| KMS API requests (Encrypt/Decrypt/GenerateDataKey) | $0.03 per 10,000 requests   |
| Automatic annual rotation         | Free                                |
| Multi-region key (optional)       | $1.00 / month per replica region    |

### Custodia projected usage

Assuming the 5-minute data-key cache:

| Workload                          | Calls/day | Source                          |
| --------------------------------- | --------- | ------------------------------- |
| Cold-start GenerateDataKey        | ~300      | Vercel functions, ~5min cache   |
| DEK rotations                     | <10       | Manual / yearly per tenant      |
| Crypto-shred                      | <5        | Account closures                |

**~10,000 calls/month → $0.03/month in API charges.**

| Component              | Monthly cost |
| ---------------------- | ------------ |
| 1× CMK (prod)          | $1.00        |
| 1× CMK (staging)       | $1.00        |
| API requests           | $0.03        |
| **Total**              | **$2.03/mo** |

> **Even if traffic 100×, you'd spend ~$5/month on KMS.** This is the
> cheapest meaningful security upgrade you'll ever buy.

### Hidden costs to watch

- **CloudTrail** logs every KMS API call. Standard CloudTrail is free for
  the first management-events trail. Data-event logging on KMS is **not**
  on by default — turn it on for SOC 2 (~$2/mo for our volume).
- **AWS Config** rules to enforce KMS hygiene: free tier covers it.
- **Cross-region traffic** if you replicate the CMK. We won't initially.

---

## Implementation plan

### Phase 1 — Provision KMS (one-time, ~30 min)

```bash
aws kms create-key \
  --description "Custodia BidFed KEK (prod)" \
  --key-usage ENCRYPT_DECRYPT \
  --customer-master-key-spec SYMMETRIC_DEFAULT \
  --tags TagKey=app,TagValue=custodia TagKey=env,TagValue=prod

aws kms create-alias \
  --alias-name alias/custodia-kek-prod \
  --target-key-id <key-id-from-above>

aws kms enable-key-rotation --key-id alias/custodia-kek-prod
```

Create an IAM role `CustodiaKekUser` with **only** these KMS permissions
on `alias/custodia-kek-prod`:

- `kms:GenerateDataKey`
- `kms:Decrypt`
- `kms:DescribeKey`

No `kms:Encrypt`, no `kms:CreateGrant`, no `kms:ScheduleKeyDeletion`.
The role's trust policy grants AssumeRole only from a specific
external ID (held in a Vercel env var) so a leaked AWS access key alone
isn't enough.

### Phase 2 — Code change

Single file: `src/lib/security/field-encryption.ts`. Replace
`loadKek()` with an async `loadKek()` that fetches a cached
**data key**, not a master key:

```ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";

const kms = new KMSClient({ region: process.env.AWS_REGION });
const KMS_KEY_ID = process.env.KMS_KEK_ALIAS!; // 'alias/custodia-kek-prod'

type DataKeyCacheEntry = { plaintext: Buffer; expiresAt: number };
let dataKeyCache: DataKeyCacheEntry | null = null;
let pendingDataKey: Promise<Buffer> | null = null;
const DATA_KEY_TTL_MS = 5 * 60 * 1000;

async function getKmsDataKey(): Promise<Buffer> {
  const now = Date.now();
  if (dataKeyCache && dataKeyCache.expiresAt > now) return dataKeyCache.plaintext;
  if (pendingDataKey) return pendingDataKey;

  pendingDataKey = (async () => {
    const out = await kms.send(new GenerateDataKeyCommand({
      KeyId: KMS_KEY_ID,
      KeySpec: "AES_256",
    }));
    if (!out.Plaintext) throw new Error("KMS returned no plaintext data key");
    const plaintext = Buffer.from(out.Plaintext);
    dataKeyCache = { plaintext, expiresAt: now + DATA_KEY_TTL_MS };
    return plaintext;
  })();

  try { return await pendingDataKey; }
  finally { pendingDataKey = null; }
}
```

Everywhere that calls `loadKek()` becomes `await getKmsDataKey()`.
Because the helpers are already async (Tier 2 work), this is a
mechanical change.

**Wire-format bump:** introduce `fv3` / `cfb3`. Existing `fv1`/`fv2` and
`cfb1`/`cfb2` continue to decrypt under the env-var KEK during the
migration, then we run the same backfill cron to forward-rewrite to v3.
Once the audit row is empty, the env-var KEK can be deleted.

### Phase 3 — Migration sequence (zero downtime)

1. Provision KMS, set `KMS_KEK_ALIAS` and AWS creds in Vercel env.
2. Deploy code that **reads** v3 but **writes** v2 (feature-flag
   `WRITE_V3=false`).
3. Verify KMS calls in CloudTrail match expected volume.
4. Flip `WRITE_V3=true`. New writes go to v3.
5. Run the backfill cron until v1 + v2 row counts are zero.
6. Remove `FIELD_ENCRYPTION_KEY` from Vercel env.
7. Tighten the IAM policy to revoke any decrypt permissions
   except from the specific Vercel build's external-ID.

### Phase 4 — Operational disciplines

- **Rotation:** annual, automatic, KMS handles it. Old data keys
  remain decryptable forever (KMS keeps every version of the CMK).
- **Crypto-shred unchanged:** still a one-row UPDATE. KMS doesn't
  see per-tenant DEKs.
- **Disaster recovery:** export the wrapped DEKs in your Postgres
  backup. Without KMS access (and without the env var fallback)
  the backup is encrypted gibberish.
- **CloudTrail alerting:** alert on any `kms:Decrypt` from an
  unexpected principal, region, or in unusual volume.

---

## What KMS does NOT solve

- **A malicious dependency** (npm supply chain attack) that runs
  inside your Vercel function still has KMS-call privileges. Mitigate
  with `npm ci --ignore-scripts`, lockfile auditing (already in CI),
  and Dependabot. *KMS narrows the blast radius — it doesn't eliminate
  it.*
- **An IAM compromise** (leaked AWS access key with KEK Decrypt
  privileges) is still catastrophic. Mitigate with: short-lived
  credentials only (no long-lived IAM users), MFA on the AWS root,
  CloudTrail alerts on KMS calls, IAM Access Analyzer.
- **A compromised admin account** that can call `kms:Decrypt` directly.
  Mitigate with separation of duties and KMS grant policies.

---

## Decision checklist before flipping

- [ ] KMS keys created in prod + staging accounts
- [ ] CloudTrail data-event logging enabled on the KEK
- [ ] IAM role scoped to GenerateDataKey + Decrypt only, no
      ScheduleKeyDeletion privilege from any human role
- [ ] AWS root account on a hardware MFA, no access keys
- [ ] Vercel env vars `KMS_KEK_ALIAS`, `AWS_REGION`,
      `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` set
- [ ] `@aws-sdk/client-kms` added to package.json
- [ ] CloudTrail alert rule wired to a real pager
- [ ] Backfill cron has run to completion (no v1/v2 rows remain)
- [ ] `FIELD_ENCRYPTION_KEY` env var removed from Vercel

---

## TL;DR for compliance reviewers

Custodia BidFed encrypts all sensitive data in the application layer
under per-tenant Data Encryption Keys. After the AWS KMS migration,
those DEKs are wrapped under a CMK that **never leaves AWS KMS**. This
satisfies NIST 800-171 SC.L2-3.13.10 (managed cryptographic keys),
FedRAMP SC-12, and SOC 2 CC6.1 controls for key management.
