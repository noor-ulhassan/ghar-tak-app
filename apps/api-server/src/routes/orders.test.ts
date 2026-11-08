import { beforeEach, describe, expect, it } from "vitest";
import {
  SIGNED_IN_AS,
  api,
  createCoupon,
  createOrder,
  createProduct,
  createProvider,
  resetDatabase,
} from "../test/helpers";

const CUSTOMER = "customer-1";
const SELLER = "seller-1";

async function storeWithMilk() {
  const store = await createProvider(SELLER);
  const milk = await createProduct(store.id, { name: "Milk", price: "180" });
  return { store, milk };
}

function orderBody(storeId: string, milkId: string, extra: Record<string, unknown> = {}) {
  return {
    providerId: storeId,
    paymentMethod: "cash_on_delivery",
    deliveryAddress: "House 1, Gulberg, Lahore",
    deliveryFee: 50,
    items: [{ productId: milkId, name: "Milk", quantity: 2, unitPrice: 180 }],
    ...extra,
  };
}

describe("orders", () => {
  beforeEach(resetDatabase);

  it("requires sign-in to place an order", async () => {
    const { store, milk } = await storeWithMilk();
    const res = await api().post("/api/orders").send(orderBody(store.id, milk.id));
    expect(res.status).toBe(401);
  });

  it.each([
    ["has no items", { items: [] }],
    ["has a zero quantity", { items: [{ productId: "x", name: "Milk", quantity: 0, unitPrice: 180 }] }],
    ["has a fractional quantity", { items: [{ productId: "x", name: "Milk", quantity: 1.5, unitPrice: 180 }] }],
    ["has a negative price", { items: [{ productId: "x", name: "Milk", quantity: 1, unitPrice: -5 }] }],
    ["has an unknown payment method", { paymentMethod: "bitcoin" }],
  ])("rejects an order that %s", async (_label, change) => {
    const { store, milk } = await storeWithMilk();
    const res = await api()
      .post("/api/orders")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send(orderBody(store.id, milk.id, change));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("places a pending order and totals items plus delivery", async () => {
    const { store, milk } = await storeWithMilk();
    const res = await api()
      .post("/api/orders")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send(orderBody(store.id, milk.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      customerId: CUSTOMER,
      providerId: store.id,
      providerName: store.name,
      status: "pending",
      total: 410,
      deliveryFee: 50,
      discount: 0,
      paymentMethod: "cash_on_delivery",
    });
  });

  it("applies a valid coupon to the total", async () => {
    const { store, milk } = await storeWithMilk();
    await createCoupon({ code: "WELCOME10", type: "percent", value: "10" });
    const res = await api()
      .post("/api/orders")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send(orderBody(store.id, milk.id, { couponCode: "welcome10" }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ discount: 36, total: 374, couponCode: "WELCOME10" });
  });

  it("shows an order to its customer and the store owner only", async () => {
    const { store, milk } = await storeWithMilk();
    const placed = await api()
      .post("/api/orders")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send(orderBody(store.id, milk.id));
    const url = `/api/orders/${placed.body.id}`;

    expect((await api().get(url).set(SIGNED_IN_AS, CUSTOMER)).status).toBe(200);
    expect((await api().get(url).set(SIGNED_IN_AS, SELLER)).status).toBe(200);
    expect((await api().get(url).set(SIGNED_IN_AS, "someone-else")).status).toBe(401);

    const mine = await api().get("/api/orders").set(SIGNED_IN_AS, CUSTOMER);
    expect(mine.body.map((o: { id: string }) => o.id)).toEqual([placed.body.id]);

    const incoming = await api().get("/api/provider-orders").set(SIGNED_IN_AS, SELLER);
    expect(incoming.body.map((o: { id: string }) => o.id)).toEqual([placed.body.id]);
  });

  it("lets the store owner move an order forward", async () => {
    const { store, milk } = await storeWithMilk();
    const placed = await api()
      .post("/api/orders")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send(orderBody(store.id, milk.id));

    const res = await api()
      .patch(`/api/orders/${placed.body.id}`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ status: "confirmed" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      "pending",
      "confirmed",
    ]);
  });

  describe("status rules", () => {
    async function orderIn(status: string) {
      const store = await createProvider(SELLER);
      const order = await createOrder(CUSTOMER, store.id, { status });
      return `/api/orders/${order.id}`;
    }

    it.each([
      ["delivered", "processing"],
      ["delivered", "cancelled"],
      ["cancelled", "pending"],
      ["shipped", "confirmed"],
      ["confirmed", "confirmed"],
    ])("stops the store moving a %s order to %s", async (from, to) => {
      const res = await api().patch(await orderIn(from)).set(SIGNED_IN_AS, SELLER).send({ status: to });
      expect(res.status).toBe(409);
    });

    it("lets the store skip steps forward", async () => {
      const res = await api().patch(await orderIn("pending")).set(SIGNED_IN_AS, SELLER).send({ status: "delivered" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("delivered");
    });

    it.each(["shipped", "delivered"])("stops the customer cancelling a %s order", async (from) => {
      const res = await api().patch(await orderIn(from)).set(SIGNED_IN_AS, CUSTOMER).send({ status: "cancelled" });
      expect(res.status).toBe(409);
    });

    it("lets the customer cancel until the order ships", async () => {
      const res = await api().patch(await orderIn("processing")).set(SIGNED_IN_AS, CUSTOMER).send({ status: "cancelled" });
      expect(res.status).toBe(200);
    });

    it("rejects an unknown status", async () => {
      const res = await api().patch(await orderIn("pending")).set(SIGNED_IN_AS, SELLER).send({ status: "lost" });
      expect(res.status).toBe(400);
    });
  });

  it("lets the customer cancel a pending order but not change it otherwise", async () => {
    const { store, milk } = await storeWithMilk();
    const placed = await api()
      .post("/api/orders")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send(orderBody(store.id, milk.id));
    const url = `/api/orders/${placed.body.id}`;

    const confirm = await api().patch(url).set(SIGNED_IN_AS, CUSTOMER).send({ status: "confirmed" });
    expect(confirm.status).toBe(401);

    const cancel = await api().patch(url).set(SIGNED_IN_AS, CUSTOMER).send({ status: "cancelled" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("cancelled");
  });
});
