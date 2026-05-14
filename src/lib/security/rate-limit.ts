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
 *
 * Three windows fire in series — first one to trip wins:
 *   1. Per-MINUTE burst cap (~scripted-flood defense)
 *   2. Per-HOUR cap (accidental loop / pasted-prompt defense)
 *   3. Per-DAY cap (runaway spend ceiling)
 *
 * Sizing rationale (chat scope, default):
 *   - Realistic full CMMC L1 self-assessment is ~200–300 turns end-to-end:
 *     onboarding (20) + profile/registration (20) + scope inventory (50) +
 *     15 practices × ~8 turns each (120) + sign/affirmation (20). Daily 600
 *     gives ~2 full walkthroughs per user-day before throttling.
 *   - At ~$0.02/turn (cached system+tools, ~7K input + 600 output on
 *     Sonnet 4.6), a fully-saturated user costs ~$12/day. 100 users worst
 *     case = ~$1200/day platform-wide.
 *   - Minute cap of 20 stops scripted floods cold (a real user is physically
 *     incapable of sending 20 chat turns in 60 seconds).
 */
export type CharlieBudgetOptions = {
  /** Logical scope. Used to namespace the rate-limit buckets. */
  scope: "chat" | "onboard" | "practice-chat";
  userId: string;
  /** Per-minute burst cap. Default 20. */
  minuteMax?: number;
  /** Per-hour ceiling. Default 150 for chat, 90 for onboard, 120 for practice-chat. */
  hourMax?: number;
  /** Per-day ceiling. Default 600 for chat, 200 for onboard, 400 for practice-chat. */
  dayMax?: number;
};

export async function enforceCharlieBudget(
  opts: CharlieBudgetOptions,
): Promise<Response | null> {
  const minuteMax = opts.minuteMax ?? 20;
  const hourMax = opts.hourMax ?? defaultHourlyCap(opts.scope);
  const dayMax =
    opts.dayMax ??
    defaultDailyCapFromEnv(opts.scope) ??
    defaultDailyCap(opts.scope);

  // Burst window first — cheap, catches scripted abuse before we ever talk to Anthropic.
  const minute = await checkRateLimit(
    rateLimitKey({
      scope: `${opts.scope}:min`,
      userId: opts.userId,
    }),
    { max: minuteMax, windowSec: 60 },
  );
  if (!minute.allowed) return rateLimitResponse(minute);

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

function defaultHourlyCap(scope: CharlieBudgetOptions["scope"]): number {
  switch (scope) {
    case "chat":
      return 150;
    case "practice-chat":
      return 120;
    case "onboard":
      return 90;
  }
}

function defaultDailyCap(scope: CharlieBudgetOptions["scope"]): number {
  switch (scope) {
    case "chat":
      return 600;
    case "practice-chat":
      return 400;
    case "onboard":
      return 200;
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
