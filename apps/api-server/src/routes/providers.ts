import { Router, type IRouter, type Request, type Response } from "express";
import { db, providersTable, productsTable, servicesTable, ordersTable, reviewsTable } from "@workspace/db";
import { eq, and, ilike, or, count, avg, inArray, sql } from "drizzle-orm";
import { CreateProviderBody, UpdateMyProviderBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { requireAuth } from "./auth";
import { categoryMatchTerms } from "./categories";
import { providerJson } from "../lib/provider-json";

const router: IRouter = Router();

/**
 * The map point and radius from a create or edit request, as the database stores them.
 * A point needs both lat and lng: half of one would put the shop in the wrong place,
 * so that gets a 400 and undefined back.
 */
function locationFields(
  body: { lat?: number; lng?: number; deliveryRadiusKm?: number },
  res: Response,
): { lat?: string; lng?: string; deliveryRadiusKm?: string } | undefined {
  if ((body.lat === undefined) !== (body.lng === undefined)) {
    const missing = body.lat === undefined ? "lat" : "lng";
    res.status(400).json({
      error: "Invalid request",
      fields: [{ field: missing, message: "Send lat and lng together" }],
    });
    return undefined;
  }
  return {
    ...(body.lat === undefined ? {} : { lat: String(body.lat), lng: String(body.lng) }),
    ...(body.deliveryRadiusKm === undefined ? {} : { deliveryRadiusKm: String(body.deliveryRadiusKm) }),
  };
}

// GET /api/providers
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const { type, q } = req.query as Record<string, string>;
    let query = db.select().from(providersTable);

    const conditions = [];
    if (type) conditions.push(eq(providersTable.type, type));
    // A repeated ?category= arrives as an array; match any of the values.
    const categories = [req.query.category].flat().filter((c): c is string => typeof c === "string" && c.trim() !== "");
    if (categories.length > 0) {
      conditions.push(inArray(sql`lower(trim(${providersTable.category}))`, categories.flatMap(categoryMatchTerms)));
    }
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

    res.json(rows.map((p) => providerJson(p)));
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
  const location = locationFields(body, res);
  if (!location) return;

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
        ...location,
        planId: "starter",
      })
      .returning();

    res.status(201).json(providerJson(provider));
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
    res.json(providerJson(provider));
  } catch (err) {
    req.log.error({ err }, "GET /providers/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/providers/me
router.patch("/providers/me", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  // Only the fields an owner may edit get through; rating, verification, plan and owner are dropped.
  const body = parseBody(UpdateMyProviderBody, req, res);
  if (!body) return;
  const location = locationFields(body, res);
  if (!location) return;
  const { lat: _lat, lng: _lng, deliveryRadiusKm: _radius, ...details } = body;

  try {
    const [provider] = await db
      .update(providersTable)
      .set({ ...details, ...location, updatedAt: new Date() })
      .where(eq(providersTable.userId, clerkUserId))
      .returning();

    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    res.json(providerJson(provider));
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
    // Revenue is money actually earned: only orders that reached the customer.
    const totalRevenue = allOrders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + Number(o.total), 0);
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
    res.json(providerJson(provider));
  } catch (err) {
    req.log.error({ err }, "GET /providers/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
