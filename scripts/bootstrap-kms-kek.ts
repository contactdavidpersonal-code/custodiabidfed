/**
 * One-shot KMS bootstrap script.
 *
 * Reads the current FIELD_ENCRYPTION_KEY (or HKDF-derives one from
 * ATTESTATION_SIGNING_KEY using the same chain `loadKekFromEnv` uses),
 * encrypts those exact 32 bytes under the prod KMS CMK, and prints
 * the base64 ciphertext blob to set as KMS_KEK_CIPHERTEXT in Vercel.
 *
 * Because the KEK plaintext is preserved across the migration, all
 * existing v1/v2 ciphertext keeps decrypting after KMS_KEK_CIPHERTEXT
 * is set and the env-var KEK is removed.
 *
 * Usage (local, with .env.local exporting the same vars Vercel has):
 *
 *   $env:FIELD_ENCRYPTION_KEY = "<paste current Vercel value>"
 *   npx tsx scripts/bootstrap-kms-kek.ts alias/custodia-kek-prod
 *
 * The runtime AWS user (custodia-kek-runtime) does NOT have kms:Encrypt;
 * use the bootstrap user (or your local dev creds) for this script.
 */

import { hkdfSync } from "node:crypto";
import {
  EncryptCommand,
  KMSClient,
} from "@aws-sdk/client-kms";

const KEY_LEN = 32;

function decodeKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_LEN * 2) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "base64");
}

function loadKekFromEnv(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (raw && raw.trim().length > 0) {
    const buf = decodeKeyMaterial(raw);
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `FIELD_ENCRYPTION_KEY must decode to ${KEY_LEN} bytes (got ${buf.length})`,
      );
    }
    return buf;
  }
  const fallback = process.env.ATTESTATION_SIGNING_KEY;
  if (!fallback) {
    throw new Error(
      "Neither FIELD_ENCRYPTION_KEY nor ATTESTATION_SIGNING_KEY is set; cannot bootstrap.",
    );
  }
  const ikm = decodeKeyMaterial(fallback);
  const derived = hkdfSync(
    "sha256",
    ikm,
    Buffer.alloc(0),
    Buffer.from("custodia.field.v1", "utf8"),
    KEY_LEN,
  );
  return Buffer.from(derived);
}

async function main(): Promise<void> {
  const aliasArg = process.argv[2] ?? "alias/custodia-kek-prod";
  const region =
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-2";

  console.log(`KMS region: ${region}`);
  console.log(`KMS alias:  ${aliasArg}`);

  const kek = loadKekFromEnv();
  console.log(`KEK source: ${process.env.FIELD_ENCRYPTION_KEY ? "FIELD_ENCRYPTION_KEY env var" : "HKDF(ATTESTATION_SIGNING_KEY)"}`);
  console.log(`KEK length: ${kek.length} bytes (expected ${KEY_LEN})`);

  const kms = new KMSClient({ region });
  const out = await kms.send(
    new EncryptCommand({
      KeyId: aliasArg,
      Plaintext: kek,
      EncryptionContext: {
        app: "custodia-bidfed",
        purpose: "kek-wrap",
      },
    }),
  );
  if (!out.CiphertextBlob || !out.KeyId) {
    throw new Error("KMS Encrypt returned no ciphertext");
  }
  const blob = Buffer.from(out.CiphertextBlob).toString("base64");

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("Set these in Vercel (Production + Preview):");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`KMS_KEK_KEY_ID=${out.KeyId}`);
  console.log(`KMS_KEK_CIPHERTEXT=${blob}`);
  console.log("AWS_REGION=" + region);
  console.log("AWS_ACCESS_KEY_ID=<from custodia-kek-runtime>");
  console.log("AWS_SECRET_ACCESS_KEY=<from custodia-kek-runtime>");
  console.log("────────────────────────────────────────────────────────────");
  console.log("\nAfter the deploy is healthy and the next request decrypts");
  console.log("an evidence blob successfully, REMOVE FIELD_ENCRYPTION_KEY");
  console.log("from Vercel. The KEK now lives only inside KMS.");
  console.log("\nNOTE: keep ATTESTATION_SIGNING_KEY \u2014 it's still used for");
  console.log("HMAC attestation signatures, separate from field encryption.");
}

main().catch((err) => {
  console.error("bootstrap-kms-kek failed:", err);
  process.exit(1);
});
