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

  it("ignores protected fields when the owner edits their store", async () => {
    const store = await createProvider(SELLER, { rating: "3.20", reviewCount: 4 });
    const res = await api()
      .patch("/api/providers/me")
      .set(SIGNED_IN_AS, SELLER)
      .send({
        name: "Honest Store",
        isVerified: true,
        rating: 5,
        reviewCount: 1000,
        planId: "pro",
        userId: "someone-else",
        id: "new-id",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: store.id,
      userId: SELLER,
      name: "Honest Store",
      isVerified: false,
      rating: 3.2,
      reviewCount: 4,
      planId: "starter",
    });
  });

  it("names the field when store details are too long", async () => {
    const signup = await api()
      .post("/api/providers")
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "Shop", type: "store", phone: "0".repeat(51) });
    expect(signup.status).toBe(400);
    expect(signup.body.fields[0].field).toBe("phone");

    await createProvider(SELLER);
    const hours = await api()
      .patch("/api/providers/me")
      .set(SIGNED_IN_AS, SELLER)
      .send({ openingHours: "x".repeat(101) });
    expect(hours.status).toBe(400);
    expect(hours.body.fields[0].field).toBe("openingHours");
  });

  it("rejects an empty store name", async () => {
    await createProvider(SELLER);
    const res = await api().patch("/api/providers/me").set(SIGNED_IN_AS, SELLER).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("returns dashboard stats for the owner", async () => {
    const store = await createProvider(SELLER);
    await createProduct(store.id);
    await createOrder("customer-1", store.id, { total: "500", status: "delivered" });

    const res = await api().get("/api/providers/me/stats").set(SIGNED_IN_AS, SELLER);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalProducts: 1, totalOrders: 1, totalRevenue: 500 });
  });

  it("counts only delivered orders as revenue", async () => {
    const store = await createProvider(SELLER);
    await createOrder("customer-1", store.id, { total: "500", status: "delivered" });
    await createOrder("customer-2", store.id, { total: "300", status: "pending" });
    await createOrder("customer-3", store.id, { total: "200", status: "cancelled" });

    const res = await api().get("/api/providers/me/stats").set(SIGNED_IN_AS, SELLER);
    expect(res.body).toMatchObject({ totalRevenue: 500, totalOrders: 2, pendingOrders: 1 });
  });
});

describe("category pages", () => {
  beforeEach(resetDatabase);

  const namesFor = async (category: string) =>
    (await api().get("/api/providers").query({ category })).body.map((p: { name: string }) => p.name).sort();

  it("lists every kind of provider in a category, whatever way the category was written", async () => {
    await createProvider("a", { name: "Al-Baraka", type: "store", category: "Grocery" });
    await createProvider("b", { name: "Fresh Mart", type: "store", category: "Groceries" });
    await createProvider("c", { name: "Daily Needs", type: "store", category: "groceries" });
    await createProvider("d", { name: "Khaddi", type: "store", category: "Fashion" });
    await createProvider("e", { name: "Ustad Raza", type: "service", category: "plumber" });
    await createProvider("f", { name: "Pipe Pros", type: "service", category: "Plumber" });
    await createProvider("g", { name: "Bundu Khan", type: "restaurant", category: "Restaurant" });

    expect(await namesFor("groceries")).toEqual(["Al-Baraka", "Daily Needs", "Fresh Mart"]);
    expect(await namesFor("clothing")).toEqual(["Khaddi"]);
    expect(await namesFor("plumber")).toEqual(["Pipe Pros", "Ustad Raza"]);
    expect(await namesFor("Plumber")).toEqual(["Pipe Pros", "Ustad Raza"]);
    expect(await namesFor("restaurant")).toEqual(["Bundu Khan"]);
    expect(await namesFor("pharmacy")).toEqual([]);
  });

  it("matches a category that isn't on the official list only to itself", async () => {
    await createProvider("a", { name: "Noor Beauty", type: "service", category: "hairdresser" });
    await createProvider("b", { name: "Ustad Raza", type: "service", category: "plumber" });

    expect(await namesFor("hairdresser")).toEqual(["Noor Beauty"]);
  });
});

describe("category filter input", () => {
  beforeEach(resetDatabase);

  it("answers a repeated category with the providers of each one", async () => {
    await createProvider("a", { name: "Al-Baraka", type: "store", category: "Grocery" });
    await createProvider("b", { name: "Khaddi", type: "store", category: "Fashion" });
    await createProvider("c", { name: "Ustad Raza", type: "service", category: "plumber" });

    const res = await api().get("/api/providers?category=groceries&category=clothing");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { name: string }) => p.name).sort()).toEqual(["Al-Baraka", "Khaddi"]);
  });
});
