import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db, providersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateMeBody } from "@workspace/api-zod";
import { ensureUser, type User } from "../lib/users";
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

async function toProfile(user: User) {
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
    res.json(await toProfile(await ensureUser(clerkUserId)));
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
    await ensureUser(clerkUserId);

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
