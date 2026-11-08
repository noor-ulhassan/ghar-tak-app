import { beforeEach, describe, expect, it } from "vitest";
import {
  SIGNED_IN_AS,
  api,
  createOrder,
  createProduct,
  createProvider,
  resetDatabase,
} from "../test/helpers";

const SELLER = "seller-1";

describe("providers", () => {
  beforeEach(resetDatabase);

  it("lists providers and filters them by type", async () => {
    await createProvider("a", { name: "Corner Store", type: "store" });
    await createProvider("b", { name: "Plumber", type: "service" });

    const all = await api().get("/api/providers");
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);

    const services = await api().get("/api/providers?type=service");
    expect(services.body.map((p: { name: string }) => p.name)).toEqual(["Plumber"]);
  });

  it("returns 404 for an unknown provider", async () => {
    const res = await api().get("/api/providers/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("registers one provider per user on the starter plan", async () => {
    const body = { name: "New Store", type: "store", address: "Main Market, Lahore" };
    const first = await api().post("/api/providers").set(SIGNED_IN_AS, SELLER).send(body);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ userId: SELLER, name: "New Store", planId: "starter" });

    const second = await api().post("/api/providers").set(SIGNED_IN_AS, SELLER).send(body);
    expect(second.status).toBe(409);
  });

  it("rejects a registration without a name or with an unknown type", async () => {
    const noName = await api()
      .post("/api/providers")
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "", type: "store" });
    expect(noName.status).toBe(400);

    const badType = await api()
      .post("/api/providers")
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "Shop", type: "bank" });
    expect(badType.status).toBe(400);
  });

  it("lets the owner edit their business details", async () => {
    await createProvider(SELLER);
    const res = await api()
      .patch("/api/providers/me")
      .set(SIGNED_IN_AS, SELLER)
      .send({
        name: "Renamed Store",
        description: "Fresh groceries",
        phone: "+92 300 0000000",
        openingHours: "9am-9pm",
        isOpen: false,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Renamed Store",
      description: "Fresh groceries",
      phone: "+92 300 0000000",
      openingHours: "9am-9pm",
      isOpen: false,
    });
  });

  it("returns dashboard stats for the owner", async () => {
    const store = await createProvider(SELLER);
    await createProduct(store.id);
    await createOrder("customer-1", store.id, { total: "500", status: "delivered" });

    const res = await api().get("/api/providers/me/stats").set(SIGNED_IN_AS, SELLER);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalProducts: 1, totalOrders: 1, totalRevenue: 500 });
  });
});
