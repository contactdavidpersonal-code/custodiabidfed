"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getSql, initDb, sprintStages, type SprintStage } from "@/lib/db";

export async function createClientAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !company) {
    throw new Error("Name and company are required");
  }

  await initDb();
  const sql = getSql();

  await sql`
    INSERT INTO clients (owner_user_id, name, company, email, notes)
    VALUES (${userId}, ${name}, ${company}, ${email || null}, ${notes || null})
  `;

  revalidatePath("/dashboard");
}

export async function updateClientStageAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const clientId = Number(formData.get("clientId"));
  const sprintStage = String(formData.get("sprintStage") ?? "") as SprintStage;

  if (!Number.isInteger(clientId) || !sprintStages.includes(sprintStage)) {
    throw new Error("Invalid client update");
  }

  await initDb();
  const sql = getSql();

  await sql`
    UPDATE clients
    SET sprint_stage = ${sprintStage}, updated_at = NOW()
    WHERE id = ${clientId} AND owner_user_id = ${userId}
  `;

  revalidatePath("/dashboard");
}
