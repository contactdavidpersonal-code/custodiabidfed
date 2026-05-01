/**
 * Postgres-backed task scheduler.
 *
 * Tasks are durable rows in `scheduled_tasks` driven by /api/cron/scheduler
 * (vercel cron, every 5 minutes). The scheduler picks every row whose
 * `next_run_at` has elapsed, runs the registered handler, and either
 * reschedules (recurring task) or marks the row done.
 *
 * Failure handling: errors are recorded on the row but the row is NOT
 * removed — the next cron tick will retry. Exponential backoff keeps a
 * stuck task from spamming.
 */

import { ensureDbReady, getSql } from "@/lib/db";

export type TaskKind =
  | "compliance_pulse.weekly"
  | "connector.refresh"
  | "monitor.run_checks";

export type TaskHandler = (ctx: TaskContext) => Promise<TaskOutcome>;

export type TaskContext = {
  taskId: string;
  organizationId: string;
  payload: Record<string, unknown>;
};

export type TaskOutcome = {
  status: "ok" | "skip" | "retry";
  /** When set, schedule the next run at this time. Omit for one-shot tasks. */
  nextRunAt?: Date;
  notes?: string;
};

const handlers: Partial<Record<TaskKind, TaskHandler>> = {};

export function registerTaskHandler(kind: TaskKind, handler: TaskHandler): void {
  handlers[kind] = handler;
}

export type ScheduleInput = {
  organizationId: string;
  kind: TaskKind;
  nextRunAt: Date;
  payload?: Record<string, unknown>;
};

export async function scheduleTask(input: ScheduleInput): Promise<void> {
  await ensureDbReady();
  const sql = getSql();
  await sql`
    INSERT INTO scheduled_tasks (organization_id, kind, payload, next_run_at)
    VALUES (
      ${input.organizationId}::uuid,
      ${input.kind},
      ${JSON.stringify(input.payload ?? {})}::jsonb,
      ${input.nextRunAt.toISOString()}
    )
  `;
}

export async function rescheduleNext(
  organizationId: string,
  kind: TaskKind,
  nextRunAt: Date,
): Promise<void> {
  await ensureDbReady();
  const sql = getSql();
  // Upsert-y: cancel the most recent same-kind task for the org, schedule new.
  await sql`
    UPDATE scheduled_tasks
    SET last_status = 'cancelled'
    WHERE organization_id = ${organizationId}::uuid
      AND kind = ${kind}
      AND last_status IS DISTINCT FROM 'cancelled'
  `;
  await scheduleTask({ organizationId, kind, nextRunAt });
}

const BACKOFF_SCHEDULE_MIN = [1, 5, 15, 60, 240, 1440] as const;

function backoffDelayMs(runCount: number): number {
  const idx = Math.min(runCount, BACKOFF_SCHEDULE_MIN.length - 1);
  return BACKOFF_SCHEDULE_MIN[idx] * 60_000;
}

export type RunResult = {
  picked: number;
  ran: number;
  errors: Array<{ taskId: string; message: string }>;
};

/**
 * Drain due tasks. Designed to fit in a single Vercel function invocation
 * (≤ 60s) — limit defaults to 25 per tick so a backlog gets caught up
 * over a few cron runs without timing out.
 */
export async function runDueTasks(opts: { limit?: number } = {}): Promise<RunResult> {
  await ensureDbReady();
  const sql = getSql();
  const limit = opts.limit ?? 25;

  const due = (await sql`
    SELECT id, organization_id, kind, payload, run_count
    FROM scheduled_tasks
    WHERE next_run_at <= NOW()
      AND (last_status IS NULL OR last_status NOT IN ('cancelled', 'done'))
    ORDER BY next_run_at ASC
    LIMIT ${limit}
  `) as Array<{
    id: string;
    organization_id: string;
    kind: TaskKind;
    payload: Record<string, unknown>;
    run_count: number;
  }>;

  const result: RunResult = { picked: due.length, ran: 0, errors: [] };

  for (const row of due) {
    const handler = handlers[row.kind];
    if (!handler) {
      await sql`
        UPDATE scheduled_tasks
        SET last_status = 'no_handler',
            last_error = ${`No handler registered for ${row.kind}`},
            last_run_at = NOW()
        WHERE id = ${row.id}::uuid
      `;
      continue;
    }
    try {
      const outcome = await handler({
        taskId: row.id,
        organizationId: row.organization_id,
        payload: row.payload ?? {},
      });
      if (outcome.status === "retry") {
        const delay = backoffDelayMs(row.run_count);
        await sql`
          UPDATE scheduled_tasks
          SET run_count = run_count + 1,
              last_status = 'retry',
              last_error = ${outcome.notes ?? null},
              last_run_at = NOW(),
              next_run_at = NOW() + (${delay} || ' milliseconds')::interval
          WHERE id = ${row.id}::uuid
        `;
      } else if (outcome.nextRunAt) {
        await sql`
          UPDATE scheduled_tasks
          SET run_count = run_count + 1,
              last_status = ${outcome.status},
              last_error = NULL,
              last_run_at = NOW(),
              next_run_at = ${outcome.nextRunAt.toISOString()}
          WHERE id = ${row.id}::uuid
        `;
      } else {
        await sql`
          UPDATE scheduled_tasks
          SET run_count = run_count + 1,
              last_status = 'done',
              last_error = NULL,
              last_run_at = NOW()
          WHERE id = ${row.id}::uuid
        `;
      }
      result.ran += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] task ${row.id} (${row.kind}) failed:`, err);
      const delay = backoffDelayMs(row.run_count);
      await sql`
        UPDATE scheduled_tasks
        SET run_count = run_count + 1,
            last_status = 'error',
            last_error = ${message},
            last_run_at = NOW(),
            next_run_at = NOW() + (${delay} || ' milliseconds')::interval
        WHERE id = ${row.id}::uuid
      `;
      result.errors.push({ taskId: row.id, message });
    }
  }

  return result;
}
