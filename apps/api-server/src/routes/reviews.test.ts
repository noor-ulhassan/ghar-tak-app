import { beforeEach, describe, expect, it } from "vitest";
import { bookingsTable, db } from "@workspace/db";
import {
  SIGNED_IN_AS,
  api,
  createOrder,
  createProvider,
  createService,
  resetDatabase,
} from "../test/helpers";

const CUSTOMER = "customer-1";
const SELLER = "seller-1";

function review(providerId: string, as: string, rating: unknown = 4) {
  return api()
    .post(`/api/providers/${providerId}/reviews`)
    .set(SIGNED_IN_AS, as)
    .send({ rating, comment: "Quick delivery" });
}

describe("reviews", () => {
  beforeEach(resetDatabase);

  it("lets a customer with a delivered order rate the store", async () => {
    const store = await createProvider(SELLER);
    await createOrder(CUSTOMER, store.id, { status: "delivered" });

    const res = await review(store.id, CUSTOMER);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ providerId: store.id, rating: 4, comment: "Quick delivery" });

    const list = await api().get(`/api/providers/${store.id}/reviews`);
    expect(list.body).toHaveLength(1);

    const updated = await api().get(`/api/providers/${store.id}`);
    expect(updated.body).toMatchObject({ rating: 4, reviewCount: 1 });
  });

  it("refuses a review without a delivered order", async () => {
    const store = await createProvider(SELLER);
    await createOrder(CUSTOMER, store.id, { status: "shipped" });

    const res = await review(store.id, CUSTOMER);
    expect(res.status).toBe(403);
  });

  it("allows one review per delivered order", async () => {
    const store = await createProvider(SELLER);
    await createOrder(CUSTOMER, store.id, { status: "delivered" });

    expect((await review(store.id, CUSTOMER)).status).toBe(201);
    expect((await review(store.id, CUSTOMER)).status).toBe(403);

    await createOrder(CUSTOMER, store.id, { status: "delivered" });
    expect((await review(store.id, CUSTOMER)).status).toBe(201);
  });

  it("counts a completed booking as a reason to review", async () => {
    const provider = await createProvider(SELLER, { type: "service" });
    const service = await createService(provider.id);
    await db.insert(bookingsTable).values({
      customerId: CUSTOMER,
      providerId: provider.id,
      providerName: provider.name,
      serviceId: service.id,
      serviceName: service.name,
      bookingDate: new Date("2030-01-15"),
      timeSlot: "10:00 - 12:00",
      address: "House 1, Lahore",
      status: "completed",
    });

    expect((await review(provider.id, CUSTOMER)).status).toBe(201);
  });

  it("stops owners from reviewing their own business", async () => {
    const store = await createProvider(SELLER);
    await createOrder(SELLER, store.id, { status: "delivered" });

    expect((await review(store.id, SELLER)).status).toBe(403);
  });

  it.each([0, 6, 4.5, "5"])("rejects a rating of %s", async (rating) => {
    const store = await createProvider(SELLER);
    await createOrder(CUSTOMER, store.id, { status: "delivered" });

    expect((await review(store.id, CUSTOMER, rating)).status).toBe(400);
  });

  it("returns 404 for an unknown provider", async () => {
    expect((await review("does-not-exist", CUSTOMER)).status).toBe(404);
  });
});
