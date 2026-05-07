/**
 * Mailforge → Instantly bootstrap.
 *
 * Reads the CSV exported from Mailforge ("Export mailboxes" → format: Instantly)
 * and creates each mailbox in Instantly with warmup enabled.
 *
 * Usage:
 *   # Dry-run (default): validates CSV, lists what would be created
 *   npx tsx scripts/instantly-bootstrap.ts .local/mailforge-mailboxes.csv
 *
 *   # Apply: actually create accounts in Instantly
 *   npx tsx scripts/instantly-bootstrap.ts .local/mailforge-mailboxes.csv --apply
 *
 * Requires:
 *   INSTANTLY_API_KEY in env (.env.local is auto-loaded by tsx if you use
 *   `--env-file=.env.local` flag, or export the var manually).
 *
 * Idempotency:
 *   The script first calls listAccounts() and skips any email already present
 *   in Instantly, so re-running is safe.
 *
 * Warmup defaults (per Mailforge + Instantly best practice for cold sending):
 *   - 14-day ramp from 1 → 30 emails/day per mailbox (we'll only use 3/day
 *     in production, but warmup pool is bigger to build deeper reputation)
 *   - 50% simulated reply rate
 *   - daily_limit: 30 (cap; campaign will throttle to 3/day actual)
 *
 * If the CSV column names differ (Mailforge has changed the export format
 * before), edit `parseRow()` below — column matching is case-insensitive.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createSmtpAccount,
  getWorkspace,
  listAccounts,
  type CreateSmtpAccountInput,
} from "../src/lib/outbound/instantly";

// -----------------------------------------------------------------------------
// CSV parsing
// -----------------------------------------------------------------------------

/** Minimal RFC-4180-ish CSV parser. Handles quoted fields with commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignore; \n will commit the row
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function colIndex(header: string[], candidates: string[]): number {
  const norm = header.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const i = norm.indexOf(cand.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function parseRow(
  header: string[],
  row: string[],
): Omit<CreateSmtpAccountInput, "warmup" | "dailyLimit"> | null {
  const get = (...names: string[]): string => {
    const i = colIndex(header, names);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  // Mailforge "Instantly" CSV columns (verified May 2026):
  //   Email,First Name,Last Name,
  //   IMAP Username,IMAP Password,IMAP Host,IMAP Port,
  //   SMTP Username,SMTP Password,SMTP Host,SMTP Port
  // Column matching is tolerant of casing + whitespace.
  const email = get("Email", "Email Address", "email");
  const firstName = get("First Name", "FirstName", "first_name");
  const lastName = get("Last Name", "LastName", "last_name");
  const imapUsername = get("IMAP Username", "imap_username");
  const imapPassword = get("IMAP Password", "imap_password");
  const imapHost = get("IMAP Host", "imap_host");
  const imapPort = parseInt(get("IMAP Port", "imap_port") || "993", 10);
  const smtpUsername = get("SMTP Username", "smtp_username");
  const smtpPassword = get("SMTP Password", "smtp_password");
  const smtpHost = get("SMTP Host", "smtp_host");
  const smtpPort = parseInt(get("SMTP Port", "smtp_port") || "465", 10);

  if (!email || !smtpHost || !smtpPassword || !imapHost || !imapPassword) {
    return null;
  }

  return {
    email,
    firstName: firstName || email.split("@")[0]!,
    lastName: lastName || "",
    smtpHost,
    smtpPort,
    smtpUsername: smtpUsername || email,
    smtpPassword,
    imapHost,
    imapPort,
    imapUsername: imapUsername || email,
    imapPassword,
  };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const csvPathArg = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");

  if (!csvPathArg) {
    console.error(
      "Usage: tsx scripts/instantly-bootstrap.ts <path-to-mailforge.csv> [--apply]",
    );
    process.exit(2);
  }

  const csvPath = resolve(csvPathArg);
  console.log(`[bootstrap] reading ${csvPath}`);
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error("[bootstrap] CSV has no data rows");
    process.exit(2);
  }
  const header = rows[0]!;
  console.log(`[bootstrap] CSV columns: ${header.join(" | ")}`);

  const dataRows = rows.slice(1);
  const parsed: ReturnType<typeof parseRow>[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const r = parseRow(header, dataRows[i]!);
    if (!r) {
      console.warn(
        `[bootstrap] row ${i + 2}: missing required field, skipping`,
      );
      continue;
    }
    parsed.push(r);
  }
  console.log(`[bootstrap] parsed ${parsed.length} mailboxes from CSV`);

  // Auth check
  console.log(`[bootstrap] verifying Instantly API key...`);
  const ws = await getWorkspace();
  console.log(
    `[bootstrap] ✓ workspace: ${ws.name ?? "(no name)"} <${ws.email ?? "?"}> id=${ws.id}`,
  );

  // Skip already-present accounts
  console.log(`[bootstrap] fetching existing accounts...`);
  const existing = await listAccounts();
  const existingEmails = new Set(existing.map((a) => a.email.toLowerCase()));
  console.log(
    `[bootstrap] ${existing.length} accounts already in Instantly`,
  );

  const todo = parsed.filter(
    (p): p is NonNullable<typeof p> =>
      p !== null && !existingEmails.has(p.email.toLowerCase()),
  );
  const skipped = parsed.length - todo.length;
  console.log(
    `[bootstrap] ${todo.length} new to create, ${skipped} already present (skipped)`,
  );

  if (todo.length === 0) {
    console.log("[bootstrap] nothing to do.");
    return;
  }

  console.log("\n=== Plan ===");
  for (const m of todo) {
    console.log(
      `  + ${m.email}  (smtp ${m.smtpHost}:${m.smtpPort}, imap ${m.imapHost}:${m.imapPort})`,
    );
  }

  if (!apply) {
    console.log(
      "\n[bootstrap] dry-run only. Re-run with --apply to actually create these.",
    );
    return;
  }

  console.log("\n=== Creating accounts in Instantly (warmup enabled) ===");
  let created = 0;
  let failed = 0;
  for (const m of todo) {
    try {
      await createSmtpAccount({
        ...m,
        dailyLimit: 30,
        warmup: {
          enabled: true,
          limit: 30,
          increment: 1,
          replyRate: 50,
        },
      });
      console.log(`  ✓ ${m.email}`);
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${m.email}: ${msg}`);
      failed++;
    }
    // Be polite to Instantly's rate limit
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(
    `\n[bootstrap] done. created=${created} failed=${failed} skipped=${skipped}`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[bootstrap] fatal:", err);
  process.exit(1);
});
