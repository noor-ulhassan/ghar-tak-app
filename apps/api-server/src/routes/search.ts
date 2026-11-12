import { Router, type IRouter, type Request, type Response } from "express";
import { db, providersTable, productsTable, servicesTable } from "@workspace/db";
import { and, eq, ilike, or } from "drizzle-orm";
import { providerJson } from "../lib/provider-json";

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
      providers: providers.map((p) => providerJson(p)),
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
