import { Router, type IRouter, type Request, type Response } from "express";
import { db, productsTable, providersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { CreateProductBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { requireAuth } from "./auth";

const router: IRouter = Router();

// The generated schema allows any number; stock must also be a whole number.
const NewProductBody = CreateProductBody.extend({ stock: z.number().int().min(0) });

function mapProduct(p: any) {
  return {
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
  };
}

// GET /api/providers/:providerId/products
router.get("/providers/:providerId/products", async (req: Request, res: Response) => {
  const { providerId } = req.params as Record<string, string>;
  const { category } = req.query as Record<string, string>;
  try {
    const conditions = [eq(productsTable.providerId, providerId)];
    if (category) conditions.push(eq(productsTable.category, category));
    const rows = await db.select().from(productsTable).where(and(...conditions));
    res.json(rows.map(mapProduct));
  } catch (err) {
    req.log.error({ err }, "GET /providers/:id/products error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/providers/:providerId/products
router.post("/providers/:providerId/products", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { providerId } = req.params as Record<string, string>;
  const body = parseBody(NewProductBody, req, res);
  if (!body) return;

  try {
    // Verify ownership
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider || provider.userId !== clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [product] = await db
      .insert(productsTable)
      .values({
        providerId,
        name: body.name,
        description: body.description ?? null,
        price: String(body.price),
        stock: body.stock ?? 0,
        sku: body.sku ?? null,
        imageUrl: body.imageUrl ?? null,
        category: body.category ?? "General",
      })
      .returning();

    res.status(201).json(mapProduct(product));
  } catch (err) {
    req.log.error({ err }, "POST /providers/:id/products error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/products/:productId
router.patch("/products/:productId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { productId } = req.params as Record<string, string>;
  const body = req.body as any;

  try {
    const [existing] = await db
      .select({ providerId: productsTable.providerId })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, existing.providerId))
      .limit(1);

    if (!provider || provider.userId !== clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.price !== undefined) updateData.price = String(body.price);

    const [updated] = await db
      .update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, productId))
      .returning();

    res.json(mapProduct(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /products/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/products/:productId
router.delete("/products/:productId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { productId } = req.params as Record<string, string>;

  try {
    const [existing] = await db
      .select({ providerId: productsTable.providerId })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, existing.providerId))
      .limit(1);

    if (!provider || provider.userId !== clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await db.delete(productsTable).where(eq(productsTable.id, productId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "DELETE /products/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
