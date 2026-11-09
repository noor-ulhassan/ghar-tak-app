import { beforeEach, describe, expect, it } from "vitest";
import {
  SIGNED_IN_AS,
  api,
  createProduct,
  createProvider,
  createService,
  resetDatabase,
} from "../test/helpers";

const SELLER = "seller-1";

describe("products and services", () => {
  beforeEach(resetDatabase);

  it("lets the owner add, edit and delete a product", async () => {
    const store = await createProvider(SELLER);

    const created = await api()
      .post(`/api/providers/${store.id}/products`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "Eggs (12)", price: 420, stock: 30, category: "Dairy" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Eggs (12)", price: 420, stock: 30 });

    const edited = await api()
      .patch(`/api/products/${created.body.id}`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "Eggs (dozen)", price: 450, stock: 25, description: "Farm eggs" });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ name: "Eggs (dozen)", price: 450, stock: 25 });

    const deleted = await api().delete(`/api/products/${created.body.id}`).set(SIGNED_IN_AS, SELLER);
    expect(deleted.status).toBe(204);

    const list = await api().get(`/api/providers/${store.id}/products`);
    expect(list.body).toEqual([]);
  });

  it("stops other users from changing a store's products", async () => {
    const store = await createProvider(SELLER);
    const milk = await createProduct(store.id);

    const create = await api()
      .post(`/api/providers/${store.id}/products`)
      .set(SIGNED_IN_AS, "someone-else")
      .send({ name: "Fake", price: 1 });
    expect(create.status).toBe(401);

    const edit = await api()
      .patch(`/api/products/${milk.id}`)
      .set(SIGNED_IN_AS, "someone-else")
      .send({ price: 1 });
    expect(edit.status).toBe(401);
  });

  it("lets the owner add and edit a service", async () => {
    const provider = await createProvider(SELLER, { type: "service" });

    const created = await api()
      .post(`/api/providers/${provider.id}/services`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "Leak Repair", priceRange: "PKR 500 - 1,500", category: "plumber" });
    expect(created.status).toBe(201);

    const edited = await api()
      .patch(`/api/services/${created.body.id}`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ priceRange: "PKR 800 - 2,000", isAvailable: false });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ priceRange: "PKR 800 - 2,000", isAvailable: false });

    const other = await createService(provider.id);
    const blocked = await api()
      .patch(`/api/services/${other.id}`)
      .set(SIGNED_IN_AS, "someone-else")
      .send({ name: "Hijacked" });
    expect(blocked.status).toBe(401);
  });
});
