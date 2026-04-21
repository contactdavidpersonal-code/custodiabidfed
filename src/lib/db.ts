import { neon } from "@neondatabase/serverless";

export const sprintStages = [
  "lead-intake",
  "sam-registration",
  "ssp-draft",
  "controls-implementation",
  "evidence-review",
  "bid-ready",
  "retainer",
] as const;

export type SprintStage = (typeof sprintStages)[number];

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return databaseUrl;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export async function initDb() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      company TEXT,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT,
      sprint_stage TEXT NOT NULL DEFAULT 'lead-intake',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        sprint_stage IN (
          'lead-intake',
          'sam-registration',
          'ssp-draft',
          'controls-implementation',
          'evidence-review',
          'bid-ready',
          'retainer'
        )
      )
    )
  `;
}
