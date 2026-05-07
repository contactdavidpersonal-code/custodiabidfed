/**
 * Instantly.ai v2 API client.
 *
 * Docs: https://developer.instantly.ai/api/v2
 *
 * Scope (current): only what we need to bootstrap the cold-outbound channel.
 *   - getWorkspace()      ping auth + return workspace info
 *   - listAccounts()      enumerate email accounts already connected
 *   - createSmtpAccount() add a Mailforge mailbox via SMTP/IMAP w/ warmup
 *
 * Out of scope here (will add later when the discovery cron is wired):
 *   - Campaigns CRUD
 *   - Leads upload
 *   - Webhook subscriptions
 *
 * Auth: Authorization: Bearer <INSTANTLY_API_KEY>.
 *
 * Failure mode: every method throws on non-2xx. Callers should try/catch
 * per-account in the bootstrap script so one bad mailbox doesn't abort the
 * whole batch.
 */

const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";

// -----------------------------------------------------------------------------
// Public types — narrow projections of the Instantly response shape.
// -----------------------------------------------------------------------------

export type InstantlyWorkspace = {
  id: string;
  name: string | null;
  email: string | null;
};

export type InstantlyAccount = {
  email: string;
  status: number | string;
  warmupStatus: number | string | null;
  dailyLimit: number | null;
  createdAt: string | null;
};

export type CreateSmtpAccountInput = {
  email: string;
  firstName: string;
  lastName: string;
  /** Mailforge SMTP creds — typically smtp.mailforge.ai:465 (SSL). */
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  /** Mailforge IMAP creds — typically imap.mailforge.ai:993 (SSL). */
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  /** Daily send cap once warmup is finished. Per-mailbox, not per-campaign. */
  dailyLimit: number;
  /** Warmup config. Recommended: enabled=true, limit=30, increment=1. */
  warmup: {
    enabled: boolean;
    limit: number;
    increment: number;
    /** % of warmup emails replied to (simulated). 30-50 is healthy. */
    replyRate: number;
  };
};

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) throw new Error("INSTANTLY_API_KEY is not set");
  return key;
}

async function instantlyFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const key = getApiKey();
  const res = await fetch(`${INSTANTLY_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  if (!res.ok) {
    // Instantly returns either { message } or { errors: [...] }; both useful.
    throw new Error(
      `Instantly ${res.status} ${init.method} ${path}: ${text.slice(0, 500)}`,
    );
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Instantly ${path}: invalid JSON response: ${text.slice(0, 200)}`,
    );
  }
}

// -----------------------------------------------------------------------------
// Public functions
// -----------------------------------------------------------------------------

/**
 * Smoke test — returns the workspace tied to the API key.
 * If this works, your INSTANTLY_API_KEY is valid.
 */
export async function getWorkspace(): Promise<InstantlyWorkspace> {
  type Raw = { id: string; name?: string | null; email?: string | null };
  const data = await instantlyFetch<Raw>("/workspaces/current");
  return { id: data.id, name: data.name ?? null, email: data.email ?? null };
}

/**
 * List all email accounts currently connected to the workspace.
 * Used by the bootstrap script to skip mailboxes that already exist.
 */
export async function listAccounts(): Promise<InstantlyAccount[]> {
  type Raw = {
    items?: Array<{
      email: string;
      status?: number | string;
      warmup_status?: number | string | null;
      daily_limit?: number | null;
      timestamp_created?: string | null;
    }>;
  };
  const data = await instantlyFetch<Raw>("/accounts?limit=100");
  return (data.items ?? []).map((a) => ({
    email: a.email,
    status: a.status ?? "unknown",
    warmupStatus: a.warmup_status ?? null,
    dailyLimit: a.daily_limit ?? null,
    createdAt: a.timestamp_created ?? null,
  }));
}

/**
 * Add a single Mailforge SMTP/IMAP mailbox to Instantly with warmup enabled.
 *
 * Provider codes per Instantly v2:
 *   1 = Google OAuth
 *   2 = Microsoft OAuth
 *   3 = SMTP/IMAP (what Mailforge uses)
 */
export async function createSmtpAccount(
  input: CreateSmtpAccountInput,
): Promise<{ email: string }> {
  const body = {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    provider_code: 3,
    smtp_username: input.smtpUsername,
    smtp_password: input.smtpPassword,
    smtp_host: input.smtpHost,
    smtp_port: input.smtpPort,
    imap_username: input.imapUsername,
    imap_password: input.imapPassword,
    imap_host: input.imapHost,
    imap_port: input.imapPort,
    daily_limit: input.dailyLimit,
    warmup: {
      limit: input.warmup.limit,
      increment: input.warmup.increment,
      reply_rate: input.warmup.replyRate,
      warmup_custom_ftag: "",
    },
    // Some accounts require enable_slow_ramp; setting true is conservative
    enable_slow_ramp: true,
  };

  type Raw = { email?: string };
  const data = await instantlyFetch<Raw>("/accounts", {
    method: "POST",
    body,
  });
  return { email: data.email ?? input.email };
}
