import { Router, type IRouter, type Request, type Response } from "express";
import {
  bookingsTable,
  db,
  ordersTable,
  providersTable,
  reviewsTable,
  servicesTable,
} from "@workspace/db";
import { and, avg, count, eq } from "drizzle-orm";
import { z } from "zod";
import { CreateReviewBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { requireAuth } from "./auth";

const router: IRouter = Router();

// The generated schema allows 4.5; a rating must be a whole number of stars.
const NewReviewBody = CreateReviewBody.extend({ rating: z.number().int().min(1).max(5) });

function mapReview(r: any) {
  return {
    id: r.id,
    providerId: r.providerId,
    serviceId: r.serviceId ?? null,
    customerId: r.customerId,
    customerName: r.customerName ?? null,
    customerAvatarUrl: r.customerAvatarUrl ?? null,
    rating: r.rating,
    comment: r.comment ?? null,
    reply: r.reply ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/services/{serviceId}/reviews
router.get("/services/:serviceId/reviews", async (req: Request, res: Response) => {
  const { serviceId } = req.params as Record<string, string>;
  try {
    const rows = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.serviceId, serviceId))
      .orderBy(reviewsTable.createdAt);
    res.json(rows.map(mapReview).reverse());
  } catch (err) {
    req.log.error({ err }, "GET /services/:id/reviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/providers/:providerId/reviews
router.get("/providers/:providerId/reviews", async (req: Request, res: Response) => {
  const { providerId } = req.params as Record<string, string>;
  try {
    const rows = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.providerId, providerId))
      .orderBy(reviewsTable.createdAt);
    res.json(rows.map(mapReview).reverse());
  } catch (err) {
    req.log.error({ err }, "GET /providers/:id/reviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/providers/:providerId/reviews
router.post("/providers/:providerId/reviews", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { providerId } = req.params as Record<string, string>;
  const body = parseBody(NewReviewBody, req, res);
  if (!body) return;
  const { rating, comment, serviceId } = body;

  try {
    const outcome = await db.transaction(async (tx) => {
      // Locking the provider row makes reviews for one provider run one at a
      // time, so the eligibility count and the average rating stay correct.
      const [provider] = await tx
        .select({ id: providersTable.id, userId: providersTable.userId })
        .from(providersTable)
        .where(eq(providersTable.id, providerId))
        .for("update");
      if (!provider) return { status: 404, error: "Provider not found" } as const;
      if (provider.userId === clerkUserId) {
        return { status: 403, error: "You can't review your own business." } as const;
      }

      if (serviceId) {
        const [service] = await tx
          .select({ id: servicesTable.id })
          .from(servicesTable)
          .where(and(eq(servicesTable.id, serviceId), eq(servicesTable.providerId, providerId)));
        if (!service) return { status: 400, error: "That service doesn't belong to this provider." } as const;
      }

      // One review for each delivered order or completed booking with this provider.
      const [delivered] = await tx
        .select({ n: count() })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.customerId, clerkUserId),
          eq(ordersTable.providerId, providerId),
          eq(ordersTable.status, "delivered"),
        ));
      const [completed] = await tx
        .select({ n: count() })
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.customerId, clerkUserId),
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed"),
        ));
      const [written] = await tx
        .select({ n: count() })
        .from(reviewsTable)
        .where(and(eq(reviewsTable.customerId, clerkUserId), eq(reviewsTable.providerId, providerId)));
      if (written.n >= delivered.n + completed.n) {
        return {
          status: 403,
          error: "You can review once for each delivered order or completed booking.",
        } as const;
      }

      const [review] = await tx
        .insert(reviewsTable)
        .values({
          providerId,
          serviceId: serviceId ?? null,
          customerId: clerkUserId,
          customerName: null,
          rating,
          comment: comment ?? null,
        })
        .returning();

      const [stats] = await tx
        .select({ avg: avg(reviewsTable.rating), count: count() })
        .from(reviewsTable)
        .where(eq(reviewsTable.providerId, providerId));
      await tx
        .update(providersTable)
        .set({
          rating: Number(stats.avg ?? 0).toFixed(2),
          reviewCount: Number(stats.count),
          updatedAt: new Date(),
        })
        .where(eq(providersTable.id, providerId));

      return { status: 201, review } as const;
    });

    if ("error" in outcome) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.status(201).json(mapReview(outcome.review));
  } catch (err) {
    req.log.error({ err }, "POST /providers/:id/reviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
