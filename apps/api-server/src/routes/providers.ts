import { Router, type IRouter, type Request, type Response } from "express";
import { db, providersTable, productsTable, servicesTable, ordersTable, reviewsTable } from "@workspace/db";
import { eq, and, ilike, or, count, avg } from "drizzle-orm";
import { CreateProviderBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { requireAuth } from "./auth";

const router: IRouter = Router();

function mapProvider(p: any, isFavorite = false) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    type: p.type,
    description: p.description ?? null,
    address: p.address ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    isOpen: p.isOpen ?? true,
    openingHours: p.openingHours ?? null,
    deliveryRadius: p.deliveryRadius ?? null,
    lat: p.lat ? Number(p.lat) : null,
    lng: p.lng ? Number(p.lng) : null,
    rating: Number(p.rating ?? 0),
    reviewCount: p.reviewCount ?? 0,
    isFavorite,
    planId: p.planId ?? null,
    category: p.category ?? null,
    isVerified: p.isVerified ?? false,
    createdAt: p.createdAt.toISOString(),
  };
}

// GET /api/providers
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const { category, type, q } = req.query as Record<string, string>;
    let query = db.select().from(providersTable);

    const conditions = [];
    if (type) conditions.push(eq(providersTable.type, type));
    if (category) conditions.push(eq(providersTable.category, category));
    if (q) {
      conditions.push(
        or(
          ilike(providersTable.name, `%${q}%`),
          ilike(providersTable.description, `%${q}%`),
        )!,
      );
    }

    const rows = conditions.length > 0
      ? await db.select().from(providersTable).where(and(...conditions))
      : await db.select().from(providersTable);

    res.json(rows.map((p) => mapProvider(p)));
  } catch (err) {
    req.log.error({ err }, "GET /providers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/providers
router.post("/providers", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const body = parseBody(CreateProviderBody, req, res);
  if (!body) return;

  try {
    // Check if user already has a provider
    const existing = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "You already have a provider profile" });
      return;
    }

    const [provider] = await db
      .insert(providersTable)
      .values({
        userId: clerkUserId,
        name: body.name,
        type: body.type ?? "store",
        description: body.description ?? null,
        address: body.address ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        category: body.category ?? null,
        openingHours: body.openingHours ?? null,
        deliveryRadius: body.deliveryRadius ?? null,
        planId: "starter",
      })
      .returning();

    res.status(201).json(mapProvider(provider));
  } catch (err) {
    req.log.error({ err }, "POST /providers error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/providers/me
router.get("/providers/me", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "No provider profile found" });
      return;
    }
    res.json(mapProvider(provider));
  } catch (err) {
    req.log.error({ err }, "GET /providers/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/providers/me
router.patch("/providers/me", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const body = req.body as any;

  try {
    const [provider] = await db
      .update(providersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(providersTable.userId, clerkUserId))
      .returning();

    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    res.json(mapProvider(provider));
  } catch (err) {
    req.log.error({ err }, "PATCH /providers/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/providers/me/stats
router.get("/providers/me/stats", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "No provider profile" });
      return;
    }

    const [productCount] = await db
      .select({ count: count() })
      .from(productsTable)
      .where(eq(productsTable.providerId, provider.id));

    const [serviceCount] = await db
      .select({ count: count() })
      .from(servicesTable)
      .where(eq(servicesTable.providerId, provider.id));

    const allOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.providerId, provider.id));

    const activeOrders = allOrders.filter((o) => o.status !== "cancelled");
    const totalRevenue = activeOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const pendingOrders = allOrders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    const today = new Date().toDateString();
    const newOrdersToday = allOrders.filter((o) => new Date(o.createdAt).toDateString() === today).length;

    res.json({
      totalRevenue,
      totalOrders: activeOrders.length,
      totalProducts: Number(productCount.count),
      totalServices: Number(serviceCount.count),
      avgRating: Number(provider.rating ?? 0),
      reviewCount: provider.reviewCount ?? 0,
      newOrdersToday,
      pendingOrders,
    });
  } catch (err) {
    req.log.error({ err }, "GET /providers/me/stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/providers/me/subscription
router.get("/providers/me/subscription", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const { subscriptionsTable } = await import("@workspace/db");
    const [provider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "No provider profile" });
      return;
    }

    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.providerId, provider.id))
      .limit(1);

    if (!sub) {
      // Return default starter plan
      const end = new Date();
      end.setFullYear(end.getFullYear() + 10);
      res.json({
        id: "default",
        providerId: provider.id,
        planId: "starter",
        planName: "Starter",
        status: "active",
        currentPeriodEnd: end.toISOString(),
      });
      return;
    }

    res.json({
      id: sub.id,
      providerId: sub.providerId,
      planId: sub.planId,
      planName: sub.planName,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "GET /providers/me/subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/providers/me/subscription
router.post("/providers/me/subscription", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { planId } = req.body as { planId: string };

  const PLANS: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    pro: "Pro",
  };

  try {
    const { subscriptionsTable } = await import("@workspace/db");
    const [provider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "No provider profile" });
      return;
    }

    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    const [existing] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.providerId, provider.id))
      .limit(1);

    let sub;
    if (existing) {
      [sub] = await db
        .update(subscriptionsTable)
        .set({ planId, planName: PLANS[planId] ?? planId, currentPeriodEnd: end, updatedAt: new Date() })
        .where(eq(subscriptionsTable.providerId, provider.id))
        .returning();
    } else {
      [sub] = await db
        .insert(subscriptionsTable)
        .values({ providerId: provider.id, planId, planName: PLANS[planId] ?? planId, currentPeriodEnd: end, status: "active" })
        .returning();
    }

    // Update provider's planId
    await db.update(providersTable).set({ planId, updatedAt: new Date() }).where(eq(providersTable.id, provider.id));

    res.json({
      id: sub.id,
      providerId: sub.providerId,
      planId: sub.planId,
      planName: sub.planName,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "POST /providers/me/subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/providers/:providerId
router.get("/providers/:providerId", async (req: Request, res: Response) => {
  const { providerId } = req.params as Record<string, string>;
  try {
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    res.json(mapProvider(provider));
  } catch (err) {
    req.log.error({ err }, "GET /providers/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
