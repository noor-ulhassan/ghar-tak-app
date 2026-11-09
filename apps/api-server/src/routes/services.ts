import { Router, type IRouter, type Request, type Response } from "express";
import { db, servicesTable, providersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateServiceBody, UpdateServiceBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { requireAuth } from "./auth";

const router: IRouter = Router();

function mapService(s: any) {
  return {
    id: s.id,
    providerId: s.providerId,
    name: s.name,
    description: s.description ?? null,
    priceRange: s.priceRange,
    duration: s.duration ?? null,
    category: s.category,
    isAvailable: s.isAvailable ?? true,
    createdAt: s.createdAt.toISOString(),
  };
}

// GET /api/providers/:providerId/services
router.get("/providers/:providerId/services", async (req: Request, res: Response) => {
  const { providerId } = req.params as Record<string, string>;
  try {
    const rows = await db.select().from(servicesTable).where(eq(servicesTable.providerId, providerId));
    res.json(rows.map(mapService));
  } catch (err) {
    req.log.error({ err }, "GET /providers/:id/services error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/providers/:providerId/services
router.post("/providers/:providerId/services", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { providerId } = req.params as Record<string, string>;
  const body = parseBody(CreateServiceBody, req, res);
  if (!body) return;

  try {
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider || provider.userId !== clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [service] = await db
      .insert(servicesTable)
      .values({
        providerId,
        name: body.name,
        description: body.description ?? null,
        priceRange: body.priceRange,
        duration: body.duration ?? null,
        category: body.category ?? "General",
      })
      .returning();

    res.status(201).json(mapService(service));
  } catch (err) {
    req.log.error({ err }, "POST /providers/:id/services error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/services/:serviceId
router.patch("/services/:serviceId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { serviceId } = req.params as Record<string, string>;
  // Only editable fields get through, so a service can't be moved to another provider.
  const body = parseBody(UpdateServiceBody, req, res);
  if (!body) return;

  try {
    const [existing] = await db
      .select({ providerId: servicesTable.providerId })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Service not found" });
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

    const [updated] = await db
      .update(servicesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(servicesTable.id, serviceId))
      .returning();

    res.json(mapService(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /services/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/services/:serviceId
router.delete("/services/:serviceId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { serviceId } = req.params as Record<string, string>;

  try {
    const [existing] = await db
      .select({ providerId: servicesTable.providerId })
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Service not found" });
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

    await db.delete(servicesTable).where(eq(servicesTable.id, serviceId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "DELETE /services/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
