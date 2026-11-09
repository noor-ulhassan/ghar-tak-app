import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
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

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Check if user is a provider
    const { providersTable } = await import("@workspace/db");
    const [provider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    res.json({
      id: user.id,
      clerkId: user.id,
      email: user.email ?? null,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      phone: null,
      avatarUrl: user.profileImageUrl ?? null,
      isProvider: !!provider,
      createdAt: user.createdAt.toISOString(),
    });
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
    const nameParts = name?.split(" ") ?? [];
    const [updated] = await db
      .update(usersTable)
      .set({
        firstName: nameParts[0] ?? null,
        lastName: nameParts.slice(1).join(" ") || null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, clerkUserId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: updated.id,
      clerkId: updated.id,
      email: updated.email ?? null,
      name: [updated.firstName, updated.lastName].filter(Boolean).join(" ") || null,
      phone: phone ?? null,
      avatarUrl: updated.profileImageUrl ?? null,
      isProvider: false,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "PATCH /auth/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { requireAuth };
export default router;
