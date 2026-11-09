import { beforeEach, describe, expect, it, vi } from "vitest";
import { clerkClient } from "@clerk/express";
import {
  SIGNED_IN_AS,
  api,
  createOrder,
  createProduct,
  createProvider,
  createService,
  createUser,
  resetDatabase,
} from "../test/helpers";

const CUSTOMER = "customer-1";
const SELLER = "seller-1";
const getUser = vi.mocked(clerkClient.users.getUser);

async function placeOrder() {
  const store = await createProvider(SELLER);
  const milk = await createProduct(store.id);
  return api()
    .post("/api/orders")
    .set(SIGNED_IN_AS, CUSTOMER)
    .send({
      providerId: store.id,
      paymentMethod: "cash_on_delivery",
      items: [{ productId: milk.id, name: "Milk", quantity: 1, unitPrice: 180 }],
    });
}

describe("customer names", () => {
  beforeEach(async () => {
    await resetDatabase();
    getUser.mockClear();
  });

  it("puts the customer's Clerk name on a new order", async () => {
    const res = await placeOrder();
    expect(res.body.customerName).toBe("Sana Malik");

    const me = await api().get("/api/auth/me").set(SIGNED_IN_AS, CUSTOMER);
    expect(me.body).toMatchObject({ name: "Sana Malik", email: `${CUSTOMER}@example.test` });
  });

  it("puts the name on bookings, reviews and chats", async () => {
    const provider = await createProvider(SELLER, { type: "service" });
    const service = await createService(provider.id);
    const booking = await api()
      .post("/api/bookings")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({
        providerId: provider.id,
        serviceId: service.id,
        bookingDate: "2030-01-15",
        timeSlot: "10:00 - 12:00",
        address: "House 1, Lahore",
      });
    expect(booking.body.customerName).toBe("Sana Malik");

    await createOrder(CUSTOMER, provider.id, { status: "delivered" });
    const review = await api()
      .post(`/api/providers/${provider.id}/reviews`)
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({ rating: 5 });
    expect(review.body).toMatchObject({
      customerName: "Sana Malik",
      customerAvatarUrl: "https://img.example.test/sana.png",
    });

    await api()
      .post(`/api/providers/${provider.id}/messages`)
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({ content: "Hello" });
    const inbox = await api().get("/api/conversations").set(SIGNED_IN_AS, SELLER);
    expect(inbox.body[0].userName).toBe("Sana Malik");
  });

  it("keeps a name saved in Ghar Tak and doesn't ask Clerk again", async () => {
    await createUser(CUSTOMER, { firstName: "Ayesha", lastName: "Khan" });
    const res = await placeOrder();

    expect(res.body.customerName).toBe("Ayesha Khan");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("still takes the order when Clerk can't be reached", async () => {
    getUser.mockRejectedValueOnce(new Error("Clerk is down"));
    const res = await placeOrder();

    expect(res.status).toBe(201);
    expect(res.body.customerName).toBeNull();
  });
});
