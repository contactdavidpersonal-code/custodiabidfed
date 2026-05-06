import { getSql } from "@/lib/db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
};

export type RateLimitOptions = {
  /** Max events allowed inside `windowSec`. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
};

/**
 * Postgres-backed fixed-window rate limit. Reliable across serverless
 * instances (no in-memory state). Bucket rows expire on next hit after
 * `windowSec` elapses.
 *
 * Failure mode: if the DB write fails we FAIL OPEN and log a warning —
 * blocking legitimate users because the rate-limit table is unavailable
 * is worse than letting one extra request through. CMMC L1 doesn't
 * require rate limiting; this is defense-in-depth.
 */
export async function checkRateLimit(
  bucketKey: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { max, windowSec } = opts;
  const sql = getSql();
  try {
    const rows = (await sql`
      INSERT INTO rate_limits (bucket, count, window_start)
      VALUES (${bucketKey}, 1, NOW())
      ON CONFLICT (bucket) DO UPDATE
      SET
        count = CASE
          WHEN rate_limits.window_start < NOW() - (${windowSec} || ' seconds')::interval
            THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < NOW() - (${windowSec} || ' seconds')::interval
            THEN NOW()
          ELSE rate_limits.window_start
        END
      RETURNING count, window_start
    `) as Array<{ count: number; window_start: Date | string }>;

    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const windowStart = row?.window_start
      ? new Date(row.window_start as string)
      : new Date();
    const resetAt = new Date(windowStart.getTime() + windowSec * 1000);
    const allowed = count <= max;
    const remaining = Math.max(0, max - count);
    const retryAfterSec = allowed
      ? 0
      : Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
    return { allowed, remaining, resetAt, retryAfterSec };
  } catch (err) {
    console.warn("[rate-limit] DB error, failing open:", err);
    return {
      allowed: true,
      remaining: max,
      resetAt: new Date(Date.now() + windowSec * 1000),
      retryAfterSec: 0,
    };
  }
}

/** Standard 429 response body. */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down.",
      retryAfterSec: result.retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSec),
      },
    },
  );
}

/** Pull a stable client identifier — userId if authed, else IP, else 'unknown'. */
export function rateLimitKey(opts: {
  scope: string;
  userId?: string | null;
  req?: Request;
}): string {
  if (opts.userId) return `${opts.scope}:u:${opts.userId}`;
  if (opts.req) {
    const fwd = opts.req.headers.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim() || opts.req.headers.get("x-real-ip");
    if (ip) return `${opts.scope}:ip:${ip}`;
  }
  return `${opts.scope}:anon`;
}

/**
 * Charlie cost guard. Every Anthropic-billing route (chat, onboarding,
 * per-practice chat) calls this before invoking the model. Two windows are
 * checked in series: a short burst window (per-hour) catches accidental loops
 * and pasted-prompt floods, and a long daily window caps runaway spend per
 * user-day at a hard ceiling that no legitimate workflow hits.
 *
 * Returns `null` if both checks pass, or a 429 `Response` to return directly.
 *
 * Defaults are tuned for Anthropic claude-sonnet pricing as of 2026-Q2 and
 * deliberately err on the generous side — false-blocking a real user mid-
 * compliance is far more expensive (in churn) than a few extra dollars of
 * spend. Override per-route via `opts`. Daily ceilings can be tightened
 * platform-wide via `CHARLIE_DAILY_CAP_*` env vars without a code change.
 */
export type CharlieBudgetOptions = {
  /** Logical scope. Used to namespace the rate-limit buckets. */
  scope: "chat" | "onboard" | "practice-chat";
  userId: string;
  /** Per-hour ceiling. Default 60. */
  hourMax?: number;
  /** Per-day ceiling. Default 200 for chat, 50 for onboard, 100 for practice-chat. */
  dayMax?: number;
};

export async function enforceCharlieBudget(
  opts: CharlieBudgetOptions,
): Promise<Response | null> {
  const hourMax = opts.hourMax ?? 60;
  const dayMax =
    opts.dayMax ??
    defaultDailyCapFromEnv(opts.scope) ??
    defaultDailyCap(opts.scope);

  const hourly = await checkRateLimit(
    rateLimitKey({ scope: opts.scope, userId: opts.userId }),
    { max: hourMax, windowSec: 60 * 60 },
  );
  if (!hourly.allowed) return rateLimitResponse(hourly);

  const daily = await checkRateLimit(
    rateLimitKey({
      scope: `${opts.scope}:day`,
      userId: opts.userId,
    }),
    { max: dayMax, windowSec: 24 * 60 * 60 },
  );
  if (!daily.allowed) return rateLimitResponse(daily);

  return null;
}

function defaultDailyCap(scope: CharlieBudgetOptions["scope"]): number {
  switch (scope) {
    case "chat":
      return 200;
    case "practice-chat":
      return 100;
    case "onboard":
      return 50;
  }
}

function defaultDailyCapFromEnv(
  scope: CharlieBudgetOptions["scope"],
): number | null {
  const envName =
    scope === "practice-chat"
      ? "CHARLIE_DAILY_CAP_PRACTICE_CHAT"
      : scope === "onboard"
        ? "CHARLIE_DAILY_CAP_ONBOARD"
        : "CHARLIE_DAILY_CAP_CHAT";
  const raw = process.env[envName];
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
