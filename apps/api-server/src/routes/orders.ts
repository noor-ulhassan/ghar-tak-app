import { Router, type IRouter, type Request, type Response } from "express";
import { addressesTable, db, ordersTable, productsTable, providersTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";
import { displayName, ensureUser } from "../lib/users";
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

// Same rule the checkout page shows: Rs 50 delivery, free from Rs 1,500.
const DELIVERY_FEE = 50;
const FREE_DELIVERY_FROM = 1500;

function deliveryFeeFor(subtotal: number) {
  return subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
}

/** A request the API turns down; every refusal happens before anything is written. */
const refusal = (status: number, error: string) => ({ status, error }) as const;

// Money is added up in whole paisa so decimals like 0.1 + 0.2 can't drift.
const toPaisa = (rupees: number) => Math.round(rupees * 100);
const toRupees = (paisa: number) => paisa / 100;

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
    deliveryPhone: o.deliveryPhone ?? null,
    deliveryInstructions: o.deliveryInstructions ?? null,
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

  // Prices and names come from the database. The browser's unitPrice and
  // deliveryFee are ignored, so editing the request can't change the total.
  const quantities = new Map<string, number>();
  for (const item of body.items) {
    if (!item.productId) {
      res.status(400).json({ error: "Every item must be a product from this store." });
      return;
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  try {
    const customer = await ensureUser(clerkUserId);

    // A saved address gives the store a street, a phone number and directions.
    let delivery = {
      deliveryAddress: body.deliveryAddress ?? null,
      deliveryPhone: customer.phone,
      deliveryInstructions: null as string | null,
    };
    if (body.addressId) {
      const [address] = await db
        .select()
        .from(addressesTable)
        .where(and(eq(addressesTable.id, body.addressId), eq(addressesTable.userId, clerkUserId)))
        .limit(1);
      if (!address) {
        res.status(400).json({ error: "That address isn't saved on your account." });
        return;
      }
      delivery = {
        deliveryAddress: [address.line1, address.city].filter(Boolean).join(", "),
        deliveryPhone: address.phone ?? customer.phone,
        deliveryInstructions: address.instructions,
      };
    }

    // One transaction: the stock checks, the stock decrease and the order
    // all save together, or none of them do.
    const outcome = await db.transaction(async (tx) => {
      const [provider] = await tx
        .select({ id: providersTable.id, name: providersTable.name, isOpen: providersTable.isOpen })
        .from(providersTable)
        .where(eq(providersTable.id, body.providerId))
        .limit(1);
      if (!provider) return refusal(404, "Provider not found");
      if (!provider.isOpen) return refusal(409, `${provider.name} is closed right now.`);

      // Locking the rows (in id order, so two orders can't deadlock) stops two
      // customers from both buying the last item.
      const products = await tx
        .select()
        .from(productsTable)
        .where(and(
          eq(productsTable.providerId, provider.id),
          inArray(productsTable.id, [...quantities.keys()]),
        ))
        .orderBy(productsTable.id)
        .for("update");
      if (products.length !== quantities.size) {
        return refusal(400, "Some items aren't sold by this store.");
      }
      for (const product of products) {
        const wanted = quantities.get(product.id)!;
        if (!product.isAvailable) return refusal(409, `${product.name} isn't available right now.`);
        if (product.stock < wanted) {
          return refusal(409, product.stock > 0
            ? `Only ${product.stock} of ${product.name} left.`
            : `${product.name} is out of stock.`);
        }
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      const items = [...quantities].map(([productId, quantity]) => {
        const product = productsById.get(productId)!;
        return {
          productId,
          serviceId: null,
          name: product.name,
          quantity,
          unitPrice: Number(product.price),
        };
      });
      const subtotal = toRupees(
        items.reduce((paisa, item) => paisa + toPaisa(item.unitPrice) * item.quantity, 0),
      );
      const deliveryFee = deliveryFeeFor(subtotal);

      let discount = 0;
      let couponCode: string | null = null;
      if (body.couponCode) {
        const coupon = await resolveCoupon(String(body.couponCode), subtotal);
        if (!coupon.valid) return refusal(400, coupon.reason);
        discount = coupon.discount;
        couponCode = coupon.code;
      }

      const total = toRupees(toPaisa(subtotal) + toPaisa(deliveryFee) - toPaisa(discount));

      for (const [productId, quantity] of quantities) {
        await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${quantity}`, updatedAt: new Date() })
          .where(eq(productsTable.id, productId));
      }

      const [order] = await tx
        .insert(ordersTable)
        .values({
          customerId: clerkUserId,
          customerName: displayName(customer),
          providerId: provider.id,
          providerName: provider.name,
          status: "pending",
          total: String(total),
          paymentMethod: body.paymentMethod ?? "cash_on_delivery",
          ...delivery,
          notes: body.notes ?? null,
          items,
          deliveryFee: String(deliveryFee),
          discount: String(discount),
          couponCode,
          statusHistory: [{ status: "pending", at: new Date().toISOString() }] as unknown as object[],
          stockReserved: true,
        })
        .returning();
      return { order };
    });

    if ("error" in outcome) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.status(201).json(mapOrder(outcome.order));
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

    const notAllowed = statusChangeRefusal(order.status, status, isProvider ? "store" : "customer");
    if (notAllowed) {
      res.status(409).json({ error: notAllowed });
      return;
    }

    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const updated = await db.transaction(async (tx) => {
      // Matching on the old status too means two changes made at once can't both apply.
      const [row] = await tx
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

      // A cancelled order gives its items back to the store's stock.
      if (row && status === "cancelled" && row.stockReserved) {
        for (const item of row.items as { productId?: string | null; quantity: number }[]) {
          if (!item.productId) continue;
          await tx
            .update(productsTable)
            .set({ stock: sql`${productsTable.stock} + ${item.quantity}`, updatedAt: new Date() })
            .where(eq(productsTable.id, item.productId));
        }
      }
      return row;
    });

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
