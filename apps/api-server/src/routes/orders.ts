import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, providersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";
import { parseBody } from "../lib/validation";
import { requireAuth } from "./auth";
import { resolveCoupon } from "./coupons";

const router: IRouter = Router();

// The generated schema allows any number; a quantity must also be a whole number.
const NewOrderBody = CreateOrderBody.extend({
  items: z
    .array(CreateOrderBody.shape.items.element.extend({ quantity: z.number().int().min(1) }))
    .min(1),
});

// An order only moves forward through these steps; a store may skip steps.
const ORDER_STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

/** Why an order can't move from one status to another, or null if it can. */
function statusChangeRefusal(from: string, to: string, by: "store" | "customer"): string | null {
  if (from === to || from === "delivered" || from === "cancelled") {
    return `This order is already ${from}.`;
  }
  if (to === "cancelled") {
    return by === "customer" && from === "shipped"
      ? "This order is already on its way and can't be cancelled."
      : null;
  }
  if (ORDER_STEPS.indexOf(to) <= ORDER_STEPS.indexOf(from)) {
    return `An order can't go back from ${from} to ${to}.`;
  }
  return null;
}

function mapOrder(o: any) {
  return {
    id: o.id,
    customerId: o.customerId,
    customerName: o.customerName ?? null,
    providerId: o.providerId,
    providerName: o.providerName,
    status: o.status,
    total: Number(o.total),
    paymentMethod: o.paymentMethod,
    deliveryAddress: o.deliveryAddress ?? null,
    notes: o.notes ?? null,
    items: Array.isArray(o.items) ? o.items : [],
    deliveryFee: Number(o.deliveryFee ?? 0),
    discount: Number(o.discount ?? 0),
    couponCode: o.couponCode ?? null,
    statusHistory: Array.isArray(o.statusHistory) ? o.statusHistory : [],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

// GET /api/orders (customer's orders)
router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, clerkUserId))
      .orderBy(ordersTable.createdAt);
    res.json(rows.map(mapOrder).reverse());
  } catch (err) {
    req.log.error({ err }, "GET /orders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/orders
router.post("/orders", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const body = parseBody(NewOrderBody, req, res);
  if (!body) return;

  try {
    const [provider] = await db
      .select({ id: providersTable.id, name: providersTable.name })
      .from(providersTable)
      .where(eq(providersTable.id, body.providerId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    const subtotal = body.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const deliveryFee = Math.max(0, Number(body.deliveryFee ?? 0));

    let discount = 0;
    let couponCode: string | null = null;
    if (body.couponCode) {
      const coupon = await resolveCoupon(String(body.couponCode), subtotal);
      if (!coupon.valid) {
        res.status(400).json({ error: coupon.reason });
        return;
      }
      discount = coupon.discount;
      couponCode = coupon.code;
    }

    const total = subtotal + deliveryFee - discount;

    const [order] = await db
      .insert(ordersTable)
      .values({
        customerId: clerkUserId,
        providerId: body.providerId,
        providerName: provider.name,
        status: "pending",
        total: String(total),
        paymentMethod: body.paymentMethod ?? "cash_on_delivery",
        deliveryAddress: body.deliveryAddress ?? null,
        notes: body.notes ?? null,
        items: body.items,
        deliveryFee: String(deliveryFee),
        discount: String(discount),
        couponCode,
        statusHistory: [{ status: "pending", at: new Date().toISOString() }] as unknown as object[],
      })
      .returning();

    res.status(201).json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "POST /orders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/orders/:orderId
router.get("/orders/:orderId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { orderId } = req.params as Record<string, string>;

  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Must be the customer or the provider owner
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, order.providerId))
      .limit(1);

    const isOwner = order.customerId === clerkUserId || provider?.userId === clerkUserId;
    if (!isOwner) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "GET /orders/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/orders/:orderId
router.patch("/orders/:orderId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { orderId } = req.params as Record<string, string>;
  const body = parseBody(UpdateOrderStatusBody, req, res);
  if (!body) return;
  const { status } = body;

  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Provider moves the order forward or cancels it; customer can only cancel
    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, order.providerId))
      .limit(1);

    const isProvider = provider?.userId === clerkUserId;
    const isCustomer = order.customerId === clerkUserId;

    if (!isProvider && !isCustomer) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (isCustomer && !isProvider && status !== "cancelled") {
      res.status(401).json({ error: "Customers can only cancel orders" });
      return;
    }

    const refusal = statusChangeRefusal(order.status, status, isProvider ? "store" : "customer");
    if (refusal) {
      res.status(409).json({ error: refusal });
      return;
    }

    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    // Matching on the old status too means two changes made at once can't both apply.
    const [updated] = await db
      .update(ordersTable)
      .set({
        status,
        statusHistory: [
          ...history,
          { status, at: new Date().toISOString() },
        ] as unknown as object[],
        updatedAt: new Date(),
      })
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.status, order.status)))
      .returning();

    if (!updated) {
      res.status(409).json({ error: "This order was just updated. Refresh and try again." });
      return;
    }

    res.json(mapOrder(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /orders/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/provider-orders (provider's incoming orders)
router.get("/provider-orders", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;

  try {
    const [provider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (!provider) {
      res.json([]);
      return;
    }

    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.providerId, provider.id))
      .orderBy(ordersTable.createdAt);

    res.json(rows.map(mapOrder).reverse());
  } catch (err) {
    req.log.error({ err }, "GET /provider-orders error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
