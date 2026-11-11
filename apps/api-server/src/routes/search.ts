import { Router, type IRouter, type Request, type Response } from "express";
import { db, providersTable, productsTable, servicesTable } from "@workspace/db";
import { and, eq, ilike, or } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/search?q=&type=all
router.get("/search", async (req: Request, res: Response) => {
  const { q, type = "all" } = req.query as { q: string; type?: string };

  if (!q || q.trim().length < 1) {
    res.json({ providers: [], products: [], services: [] });
    return;
  }

  const term = `%${q.trim()}%`;

  try {
    let providers: any[] = [];
    let products: any[] = [];
    let services: any[] = [];

    if (type === "all" || type === "providers") {
      providers = await db
        .select()
        .from(providersTable)
        .where(
          or(
            ilike(providersTable.name, term),
            ilike(providersTable.description, term),
            ilike(providersTable.category, term),
          )!,
        )
        .limit(10);
    }

    if (type === "all" || type === "products") {
      products = await db
        .select()
        .from(productsTable)
        .where(
          // Search is for shoppers: leave out what the store has switched off.
          and(
            eq(productsTable.isAvailable, true),
            or(
              ilike(productsTable.name, term),
              ilike(productsTable.description, term),
              ilike(productsTable.category, term),
            ),
          ),
        )
        .limit(10);
    }

    if (type === "all" || type === "services") {
      services = await db
        .select()
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.isAvailable, true),
            or(
              ilike(servicesTable.name, term),
              ilike(servicesTable.description, term),
              ilike(servicesTable.category, term),
            ),
          ),
        )
        .limit(10);
    }

    res.json({
      providers: providers.map((p) => ({
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
        isFavorite: false,
        planId: p.planId ?? null,
        category: p.category ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      products: products.map((p) => ({
        id: p.id,
        providerId: p.providerId,
        name: p.name,
        description: p.description ?? null,
        price: Number(p.price),
        stock: p.stock ?? 0,
        sku: p.sku ?? null,
        imageUrl: p.imageUrl ?? null,
        category: p.category,
        isAvailable: p.isAvailable ?? true,
        createdAt: p.createdAt.toISOString(),
      })),
      services: services.map((s) => ({
        id: s.id,
        providerId: s.providerId,
        name: s.name,
        description: s.description ?? null,
        priceRange: s.priceRange,
        duration: s.duration ?? null,
        category: s.category,
        isAvailable: s.isAvailable ?? true,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /search error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
