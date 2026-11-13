import { beforeEach, describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";
import { db, providersTable } from "@workspace/db";
import { backfillDeliveryRadius } from "@workspace/db/backfill-delivery-radius";
import {
  DEFAULT_DELIVERY_RADIUS_KM,
  EARTH_RADIUS_KM,
  MAX_DELIVERY_RADIUS_KM,
  MIN_DELIVERY_RADIUS_KM,
  distanceKm,
} from "@workspace/geo";
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

describe("shop map point and delivery radius", () => {
  beforeEach(resetDatabase);

  const AL_BARAKA = { lat: 31.5204, lng: 74.3587 };
  const editShop = (fields: Record<string, unknown>) =>
    api().patch("/api/providers/me").set(SIGNED_IN_AS, SELLER).send(fields);

  it("saves the map point and radius given at signup", async () => {
    const res = await api()
      .post("/api/providers")
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "New Store", type: "store", ...AL_BARAKA, deliveryRadiusKm: 7.5 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...AL_BARAKA, deliveryRadiusKm: 7.5 });

    const again = await api().get(`/api/providers/${res.body.id}`);
    expect(again.body).toMatchObject({ ...AL_BARAKA, deliveryRadiusKm: 7.5 });
  });

  it("leaves the map point and radius empty when signup doesn't send them", async () => {
    const res = await api().post("/api/providers").set(SIGNED_IN_AS, SELLER).send({ name: "New Store", type: "store" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ lat: null, lng: null, deliveryRadiusKm: null });
  });

  it("lets the owner set the map point, move it and change the radius", async () => {
    await createProvider(SELLER);

    const set = await editShop({ ...AL_BARAKA, deliveryRadiusKm: 3 });
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({ ...AL_BARAKA, deliveryRadiusKm: 3 });

    const moved = await editShop({ lat: 31.55, lng: 74.34 });
    expect(moved.body).toMatchObject({ lat: 31.55, lng: 74.34, deliveryRadiusKm: 3 });

    const renamed = await editShop({ name: "Renamed Store" });
    expect(renamed.body).toMatchObject({ name: "Renamed Store", lat: 31.55, lng: 74.34, deliveryRadiusKm: 3 });
  });

  it("keeps the map point to 7 decimal places (about 1 cm)", async () => {
    await createProvider(SELLER);
    const res = await editShop({ lat: 31.123456789, lng: 74.987654321 });
    expect(res.body).toMatchObject({ lat: 31.1234568, lng: 74.9876543 });
  });

  it("refuses half a map point", async () => {
    const signup = await api()
      .post("/api/providers")
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "New Store", type: "store", lat: 31.5 });
    expect(signup.status).toBe(400);
    expect(signup.body.fields[0].field).toBe("lng");

    await createProvider(SELLER, { lat: "31.5204000", lng: "74.3587000" });
    const edit = await editShop({ lng: 74 });
    expect(edit.status).toBe(400);
    expect(edit.body.fields[0].field).toBe("lat");
    const shop = await api().get("/api/providers/me").set(SIGNED_IN_AS, SELLER);
    expect(shop.body).toMatchObject(AL_BARAKA);
  });

  it("refuses coordinates that aren't on the globe or aren't numbers", async () => {
    await createProvider(SELLER);
    const cases: [Record<string, unknown>, string][] = [
      [{ lat: 90.1, lng: 74 }, "lat"],
      [{ lat: -90.1, lng: 74 }, "lat"],
      [{ lat: 31, lng: 180.1 }, "lng"],
      [{ lat: 31, lng: -180.1 }, "lng"],
      [{ lat: "31.5", lng: 74 }, "lat"],
    ];
    for (const [fields, field] of cases) {
      const res = await editShop(fields);
      expect(res.status).toBe(400);
      expect(res.body.fields[0].field).toBe(field);
    }
    expect((await editShop({ lat: 90, lng: -180 })).status).toBe(200);
  });

  it("accepts a radius from the minimum to the maximum and refuses anything outside", async () => {
    await createProvider(SELLER);
    for (const km of [MIN_DELIVERY_RADIUS_KM, MAX_DELIVERY_RADIUS_KM]) {
      const res = await editShop({ deliveryRadiusKm: km });
      expect(res.status).toBe(200);
      expect(res.body.deliveryRadiusKm).toBe(km);
    }
    for (const km of [MIN_DELIVERY_RADIUS_KM - 0.1, MAX_DELIVERY_RADIUS_KM + 0.1, 0, -5]) {
      const res = await editShop({ deliveryRadiusKm: km });
      expect(res.status).toBe(400);
      expect(res.body.fields[0].field).toBe("deliveryRadiusKm");
    }
  });

  it("returns the map point and radius from search as well", async () => {
    await createProvider("a", { name: "Corner Store", lat: "31.5204000", lng: "74.3587000", deliveryRadiusKm: "8.0" });
    const res = await api().get("/api/search?q=Corner");
    expect(res.body.providers[0]).toMatchObject({ ...AL_BARAKA, deliveryRadiusKm: 8, isVerified: false });
  });
});

describe("copying the old delivery radius text", () => {
  beforeEach(resetDatabase);

  it("copies plain '<number> km' values from 0.5 to 50, reports the rest, and can run again", async () => {
    const shop = (name: string, deliveryRadius: string | null, deliveryRadiusKm?: string) =>
      createProvider(name, { name, deliveryRadius, deliveryRadiusKm });
    await shop("a", "5 km");
    await shop("b", " 12.5 KM ");
    await shop("c", "8km");
    await shop("d", "about 5 km");
    await shop("e", "100 km");
    await shop("f", "0 km");
    await shop("g", null);
    await shop("h", "9 km", "3.0");

    const first = await backfillDeliveryRadius();
    expect(first.updated).toBe(3);
    expect(first.skipped.map((row) => row.name)).toEqual(["d", "e", "f"]);
    // "h" was saved as 3 km while its old text says 9 km.
    expect(first.differing.map((row) => [row.name, Number(row.km)])).toEqual([["h", 3]]);

    const rows = await db
      .select({ name: providersTable.name, km: providersTable.deliveryRadiusKm })
      .from(providersTable)
      .orderBy(asc(providersTable.name));
    expect(rows.map((row) => [row.name, row.km == null ? null : Number(row.km)])).toEqual([
      ["a", 5],
      ["b", 12.5],
      ["c", 8],
      ["d", null],
      ["e", null],
      ["f", null],
      ["g", null],
      ["h", 3],
    ]);

    expect((await backfillDeliveryRadius()).updated).toBe(0);
  });
});

describe("providers that reach the customer", () => {
  beforeEach(resetDatabase);

  const CUSTOMER = { lat: 31.5204, lng: 74.3587 };
  // The point `km` due north of the customer. The database keeps 7 decimals, a few mm.
  const north = (km: number) => ({
    lat: (CUSTOMER.lat + ((km / EARTH_RADIUS_KM) * 180) / Math.PI).toFixed(7),
    lng: CUSTOMER.lng.toFixed(7),
  });
  const shop = (name: string, km: number | null, radiusKm: number | null, fields: Record<string, unknown> = {}) =>
    createProvider(name, {
      name,
      ...(km === null ? {} : north(km)),
      deliveryRadiusKm: radiusKm === null ? null : String(radiusKm),
      ...fields,
    });
  const nearby = (query: Record<string, string | number> = {}) =>
    api().get("/api/providers").query({ ...CUSTOMER, ...query });

  it("lists only the providers whose radius reaches the customer, nearest first", async () => {
    await shop("Karachi store", null, 50, { lat: "24.8607000", lng: "67.0011000" });
    await shop("Big radius", 6, 8);
    await shop("Too far for its radius", 6, 5);
    await shop("Default radius, far", 6, null);
    await shop("No map point", null, 50);
    await shop("Default radius, close", 4, null);
    await shop("In range", 3, 5);

    const res = await nearby();
    expect(res.status).toBe(200);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(["In range", "Default radius, close", "Big radius"]);
    expect(res.body.map((p: { distanceKm: number }) => p.distanceKm)).toEqual([
      expect.closeTo(3, 4),
      expect.closeTo(4, 4),
      expect.closeTo(6, 4),
    ]);
  });

  it("measures distance exactly as the shared geo code does", async () => {
    await shop("A", 2.5, 5);
    const [p] = (await nearby()).body;
    expect(p.distanceKm).toBeCloseTo(distanceKm(CUSTOMER, { lat: p.lat, lng: p.lng }), 9);
  });

  it("includes a provider just inside its radius and leaves out one just outside", async () => {
    await shop("Inside", DEFAULT_DELIVERY_RADIUS_KM - 0.01, null);
    await shop("Outside", DEFAULT_DELIVERY_RADIUS_KM + 0.01, null);
    await shop("Inside its own radius", 9.99, 10);
    await shop("Outside its own radius", 10.01, 10);

    const names = (await nearby()).body.map((p: { name: string }) => p.name);
    expect(names).toEqual(["Inside", "Inside its own radius"]);
  });

  it("combines the location with the type and category filters", async () => {
    await shop("Plumber", 1, 5, { type: "service", category: "plumber" });
    await shop("Grocer", 2, 5, { type: "store", category: "Grocery" });
    await shop("Far plumber", 9, 5, { type: "service", category: "plumber" });

    expect((await nearby({ type: "service" })).body.map((p: { name: string }) => p.name)).toEqual(["Plumber"]);
    expect((await nearby({ category: "groceries" })).body.map((p: { name: string }) => p.name)).toEqual(["Grocer"]);
  });

  it("lists every provider, without distances, when no location is sent", async () => {
    await shop("In range", 3, 5);
    await shop("Far away", 300, 5);
    await shop("No map point", null, null);

    const res = await api().get("/api/providers");
    expect(res.body).toHaveLength(3);
    expect(res.body.every((p: object) => !("distanceKm" in p))).toBe(true);
  });

  it("agrees with the shared geo code on who is in range and how far", async () => {
    // 60 shops scattered up to about 45 km away, with radii from 1 to 30 km.
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const shops = [];
    for (let i = 0; i < 60; i++) {
      const point = {
        lat: (CUSTOMER.lat + (random() - 0.5) * 0.8).toFixed(7),
        lng: (CUSTOMER.lng + (random() - 0.5) * 0.8).toFixed(7),
      };
      const radiusKm = (1 + Math.floor(random() * 290) / 10).toFixed(1);
      shops.push(await createProvider(`s${i}`, { name: `s${i}`, ...point, deliveryRadiusKm: radiusKm }));
    }
    const expected = shops
      .map((p) => ({ name: p.name, km: distanceKm(CUSTOMER, { lat: Number(p.lat), lng: Number(p.lng) }), radius: Number(p.deliveryRadiusKm) }))
      .filter((p) => p.km <= p.radius)
      .sort((a, b) => a.km - b.km);

    const res = await nearby();
    expect(expected.length).toBeGreaterThan(5);
    expect(expected.length).toBeLessThan(55);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(expected.map((p) => p.name));
    res.body.forEach((p: { distanceKm: number }, i: number) => expect(p.distanceKm).toBeCloseTo(expected[i].km, 9));
  });

  it("refuses half a location, an empty one, or one that isn't on the globe", async () => {
    for (const query of [
      { lat: "31.52" },
      { lng: "74.35" },
      { lat: "", lng: "74.35" },
      { lat: " ", lng: "74.35" },
      { lat: "31.52", lng: "  " },
      { lat: "abc", lng: "74.35" },
      { lat: "91", lng: "74.35" },
      { lat: "31.52", lng: "-181" },
    ]) {
      const res = await api().get("/api/providers").query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
    }
    const half = await api().get("/api/providers").query({ lat: "31.52" });
    expect(half.body.fields).toEqual([{ field: "lng", message: "Send lat and lng together" }]);
  });
});
