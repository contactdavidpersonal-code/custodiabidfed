"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ensureOrgForUser } from "@/lib/assessment";
import { revokeConnectorToken } from "@/lib/connectors/storage";
import type { ConnectorProvider } from "@/lib/connectors/types";

const PROVIDERS: ReadonlyArray<ConnectorProvider> = ["m365", "google_workspace"];

export async function disconnectConnectorAction(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");

  const provider = String(formData.get("provider") ?? "") as ConnectorProvider;
  if (!PROVIDERS.includes(provider)) throw new Error("invalid_provider");

  const org = await ensureOrgForUser(userId);
  await revokeConnectorToken(org.id, provider);
  revalidatePath("/assessments/connections");
}
