import { beforeEach, describe, expect, it } from "vitest";
import { SIGNED_IN_AS, api, createOrder, createProvider, resetDatabase } from "../test/helpers";

const CUSTOMER = "customer-1";

describe("reviews", () => {
  beforeEach(resetDatabase);

  it("lets a customer with a delivered order rate the store", async () => {
    const store = await createProvider("seller-1");
    await createOrder(CUSTOMER, store.id, { status: "delivered" });

    const res = await api()
      .post(`/api/providers/${store.id}/reviews`)
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({ rating: 4, comment: "Quick delivery" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ providerId: store.id, rating: 4, comment: "Quick delivery" });

    const list = await api().get(`/api/providers/${store.id}/reviews`);
    expect(list.body).toHaveLength(1);

    const updated = await api().get(`/api/providers/${store.id}`);
    expect(updated.body).toMatchObject({ rating: 4, reviewCount: 1 });
  });
});
