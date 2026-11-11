import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, providersTable } from "@workspace/db";

/** Whether the signed-in user, if any, owns this store or service provider. */
export async function viewerOwnsProvider(req: Request, providerId: string): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  const [provider] = await db
    .select({ userId: providersTable.userId })
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);
  return provider?.userId === userId;
}
