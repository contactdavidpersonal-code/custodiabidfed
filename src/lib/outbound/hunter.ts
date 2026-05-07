/**
 * Hunter.io API client — outbound enrichment for the cold-email channel.
 *
 * Docs: https://hunter.io/api-documentation/v2
 *
 * Scope of this module:
 *   - Domain Search:    company → list of email patterns + emails on staff
 *   - Email Finder:     first/last + domain → best-guess email + confidence
 *   - Email Verifier:   email → deliverability verdict (catches typos, traps)
 *   - Account:          ping the account endpoint (used by /api/outbound/hunter-test)
 *
 * What this module does NOT do:
 *   - It does not persist anything. Callers decide whether to cache results.
 *   - It does not enforce rate limits. Hunter Starter is 500/mo verifier +
 *     500/mo finder; we'll add a counter in the pipeline scaffolding when we
 *     wire the cron job. For now, every call is direct.
 *
 * Failure mode:
 *   - All functions throw on transport error or non-2xx HTTP.
 *   - Callers should try/catch and treat any throw as "skip this prospect".
 *   - We log the failed URL with the API key REDACTED.
 */

const HUNTER_BASE = "https://api.hunter.io/v2";

// -----------------------------------------------------------------------------
// Public response types — narrow projections of the Hunter API. We only pull
// out fields the pipeline actually uses, so changes upstream don't ripple.
// -----------------------------------------------------------------------------

/** A single email row returned by Domain Search. */
export type HunterDomainEmail = {
  value: string;
  type: "personal" | "generic" | string;
  confidence: number; // 0-100
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  department: string | null;
  seniority: string | null;
  linkedin: string | null;
  twitter: string | null;
  phoneNumber: string | null;
  verification: {
    date: string | null;
    status: string | null; // "valid" | "invalid" | "accept_all" | etc
  };
};

export type HunterDomainSearchResult = {
  domain: string;
  organization: string | null;
  pattern: string | null; // e.g. "{first}.{last}@{domain}"
  industry: string | null;
  country: string | null;
  emails: HunterDomainEmail[];
};

export type HunterEmailFinderResult = {
  email: string | null;
  score: number | null; // 0-100
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  domain: string | null;
  verificationStatus: string | null; // "valid" | "accept_all" | etc
};

export type HunterVerifierResult = {
  email: string;
  status: string; // "valid" | "invalid" | "accept_all" | "webmail" | "disposable" | "unknown"
  result: string; // "deliverable" | "undeliverable" | "risky" | "unknown"
  score: number;
  acceptAll: boolean;
  disposable: boolean;
  webmail: boolean;
  mxRecords: boolean;
  smtpServer: boolean;
  smtpCheck: boolean;
};

export type HunterAccount = {
  email: string;
  planName: string;
  resetDate: string | null;
  calls: { used: number; available: number };
  verifications: { used: number; available: number };
};

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.HUNTER_API_KEY;
  if (!key) {
    throw new Error("HUNTER_API_KEY is not set");
  }
  return key;
}

/** Shared fetch wrapper. Returns parsed JSON.data or throws with context. */
async function hunterGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = getApiKey();
  const url = new URL(`${HUNTER_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    // Hunter is fast (<1s) but be defensive against hung sockets.
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { errors?: Array<{ details?: string }> };
      detail = body.errors?.[0]?.details ?? "";
    } catch {
      /* ignore */
    }
    const redactedUrl = url.toString().replace(key, "***");
    throw new Error(
      `Hunter ${res.status} on ${path}${detail ? `: ${detail}` : ""} (${redactedUrl})`,
    );
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

// -----------------------------------------------------------------------------
// Public functions
// -----------------------------------------------------------------------------

/**
 * GET /v2/account — quick ping. Returns plan + remaining quota.
 * Used by the test endpoint to verify the API key is wired.
 */
export async function getAccount(): Promise<HunterAccount> {
  type Raw = {
    email: string;
    plan_name: string;
    reset_date: string | null;
    calls: { used: number; available: number };
    requests?: {
      searches?: { used: number; available: number };
      verifications?: { used: number; available: number };
    };
  };
  const data = await hunterGet<Raw>("/account", {});
  return {
    email: data.email,
    planName: data.plan_name,
    resetDate: data.reset_date,
    calls: data.calls ??
      data.requests?.searches ?? { used: 0, available: 0 },
    verifications:
      data.requests?.verifications ?? { used: 0, available: 0 },
  };
}

/**
 * GET /v2/domain-search — list emails associated with a company domain.
 * Best for: bulk discovery on awarded companies where we have the website.
 */
export async function domainSearch(opts: {
  domain: string;
  /** Optional company name when domain is unknown — Hunter will resolve. */
  company?: string;
  /** Max emails returned (Hunter caps at 100). Default 10. */
  limit?: number;
  /** Filter to "personal" only — drops info@/sales@/etc. Default true. */
  personalOnly?: boolean;
  /** Filter by job seniority: junior, senior, executive. Optional. */
  seniority?: "junior" | "senior" | "executive";
  /** Filter by department: it, finance, executive, etc. Optional. */
  department?: string;
}): Promise<HunterDomainSearchResult> {
  type RawEmail = {
    value: string;
    type: string;
    confidence: number;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    department: string | null;
    seniority: string | null;
    linkedin: string | null;
    twitter: string | null;
    phone_number: string | null;
    verification?: { date: string | null; status: string | null };
  };
  type Raw = {
    domain: string;
    organization: string | null;
    pattern: string | null;
    industry: string | null;
    country: string | null;
    emails: RawEmail[];
  };

  const data = await hunterGet<Raw>("/domain-search", {
    domain: opts.domain,
    company: opts.company,
    limit: opts.limit ?? 10,
    type: opts.personalOnly === false ? undefined : "personal",
    seniority: opts.seniority,
    department: opts.department,
  });

  return {
    domain: data.domain,
    organization: data.organization,
    pattern: data.pattern,
    industry: data.industry,
    country: data.country,
    emails: (data.emails ?? []).map((e) => ({
      value: e.value,
      type: e.type,
      confidence: e.confidence,
      firstName: e.first_name,
      lastName: e.last_name,
      position: e.position,
      department: e.department,
      seniority: e.seniority,
      linkedin: e.linkedin,
      twitter: e.twitter,
      phoneNumber: e.phone_number,
      verification: {
        date: e.verification?.date ?? null,
        status: e.verification?.status ?? null,
      },
    })),
  };
}

/**
 * GET /v2/email-finder — given a name + company, return the best-guess email.
 * Best for: targeted enrichment when we know who we want to reach.
 */
export async function emailFinder(opts: {
  domain?: string;
  company?: string;
  firstName: string;
  lastName: string;
}): Promise<HunterEmailFinderResult> {
  if (!opts.domain && !opts.company) {
    throw new Error("emailFinder requires either domain or company");
  }
  type Raw = {
    email: string | null;
    score: number | null;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    domain: string | null;
    verification?: { status: string | null };
  };
  const data = await hunterGet<Raw>("/email-finder", {
    domain: opts.domain,
    company: opts.company,
    first_name: opts.firstName,
    last_name: opts.lastName,
  });
  return {
    email: data.email,
    score: data.score,
    firstName: data.first_name,
    lastName: data.last_name,
    position: data.position,
    domain: data.domain,
    verificationStatus: data.verification?.status ?? null,
  };
}

/**
 * GET /v2/email-verifier — verify a single email address.
 * Best for: last-mile sanity check before sending. Burns 1 verification credit.
 */
export async function emailVerifier(email: string): Promise<HunterVerifierResult> {
  type Raw = {
    email: string;
    status: string;
    result: string;
    score: number;
    accept_all: boolean;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_server: boolean;
    smtp_check: boolean;
  };
  const data = await hunterGet<Raw>("/email-verifier", { email });
  return {
    email: data.email,
    status: data.status,
    result: data.result,
    score: data.score,
    acceptAll: data.accept_all,
    disposable: data.disposable,
    webmail: data.webmail,
    mxRecords: data.mx_records,
    smtpServer: data.smtp_server,
    smtpCheck: data.smtp_check,
  };
}

/**
 * Convenience: best-effort "find a deliverable contact email" for a company,
 * given just a domain. Used by the discovery cron when USAspending gives us
 * an awardee with a website but no named POC.
 *
 * Strategy:
 *   1. Domain search filtered to "personal" emails, top 10 by confidence
 *   2. Skip any with verification.status === "invalid"
 *   3. Prefer senior/executive titles (founder, ceo, coo, president, owner,
 *      operations, security, compliance, IT)
 *   4. Return the highest-confidence match, or null if none qualify
 */
export async function bestContactForDomain(
  domain: string,
): Promise<HunterDomainEmail | null> {
  const result = await domainSearch({ domain, limit: 25, personalOnly: true });
  const candidates = result.emails.filter(
    (e) => e.verification.status !== "invalid" && !!e.value,
  );
  if (candidates.length === 0) return null;

  const TITLE_KEYWORDS = [
    "founder",
    "ceo",
    "coo",
    "cto",
    "president",
    "owner",
    "principal",
    "managing",
    "director",
    "operations",
    "security",
    "compliance",
    "information",
    "it ",
    "facility",
    "facilities",
  ];
  const scored = candidates.map((e) => {
    const title = (e.position ?? "").toLowerCase();
    const titleMatch = TITLE_KEYWORDS.some((k) => title.includes(k));
    return { e, score: e.confidence + (titleMatch ? 25 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.e ?? null;
}
