import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db, providersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateMeBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkUserId = userId;
  next();
}

// Upsert a local user record from Clerk data
async function getOrCreateUser(clerkUserId: string, clerkUser?: any) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, clerkUserId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(usersTable)
    .values({
      id: clerkUserId,
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? null,
      firstName: clerkUser?.firstName ?? null,
      lastName: clerkUser?.lastName ?? null,
      profileImageUrl: clerkUser?.imageUrl ?? null,
    })
    .returning();
  return created;
}

async function toProfile(user: typeof usersTable.$inferSelect) {
  const [provider] = await db
    .select({ id: providersTable.id })
    .from(providersTable)
    .where(eq(providersTable.userId, user.id))
    .limit(1);

  return {
    id: user.id,
    clerkId: user.id,
    email: user.email ?? null,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    phone: user.phone ?? null,
    avatarUrl: user.profileImageUrl ?? null,
    isProvider: !!provider,
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(await toProfile(user));
  } catch (err) {
    req.log.error({ err }, "GET /auth/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/auth/me
router.patch("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const body = parseBody(UpdateMeBody, req, res);
  if (!body) return;
  const { name, phone } = body;

  try {
    await getOrCreateUser(clerkUserId);

    // Only the fields sent are changed, so saving just a phone keeps the name.
    const changes: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      changes.firstName = parts[0] ?? null;
      changes.lastName = parts.slice(1).join(" ") || null;
    }
    if (phone !== undefined) changes.phone = phone.trim() || null;

    const [updated] = await db
      .update(usersTable)
      .set(changes)
      .where(eq(usersTable.id, clerkUserId))
      .returning();

    res.json(await toProfile(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /auth/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { requireAuth };
export default router;
