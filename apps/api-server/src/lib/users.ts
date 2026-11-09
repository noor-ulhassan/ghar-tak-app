import { clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type User = typeof usersTable.$inferSelect;

async function findUser(id: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user;
}

/** Name, email and photo from the person's Clerk account, or null if Clerk can't be reached. */
async function loadClerkProfile(userId: string) {
  try {
    const account = await clerkClient.users.getUser(userId);
    const primaryEmail = account.emailAddresses.find((e) => e.id === account.primaryEmailAddressId);
    return {
      firstName: account.firstName ?? null,
      lastName: account.lastName ?? null,
      email: (primaryEmail ?? account.emailAddresses[0])?.emailAddress ?? null,
      profileImageUrl: account.imageUrl ?? null,
    };
  } catch (err) {
    logger.warn({ err, userId }, "Could not load the Clerk profile");
    return null;
  }
}

/**
 * The local user row for a signed-in person, created on first use. Its name,
 * email and photo are copied from Clerk only while the row has none, so most
 * calls never contact Clerk, and a name saved in Ghar Tak is never overwritten.
 */
export async function ensureUser(userId: string): Promise<User> {
  const existing = await findUser(userId);
  if (existing && (existing.firstName || existing.lastName || existing.email)) return existing;

  const profile = await loadClerkProfile(userId);
  if (existing) {
    if (!profile) return existing;
    const [updated] = await db
      .update(usersTable)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(usersTable)
    .values({ id: userId, ...profile })
    .onConflictDoNothing({ target: usersTable.id })
    .returning();
  // Another request may have created the row a moment earlier.
  return created ?? (await findUser(userId))!;
}

/** The name to show for a person: their full name, else their email. */
export function displayName(user: Pick<User, "firstName" | "lastName" | "email">): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || null;
}
