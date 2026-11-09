import { beforeEach, describe, expect, it } from "vitest";
import { SIGNED_IN_AS, api, createProvider, createService, resetDatabase } from "../test/helpers";

const CUSTOMER = "customer-1";
const SELLER = "seller-1";

describe("bookings", () => {
  beforeEach(resetDatabase);

  it("books a service, which the provider confirms and the customer can see", async () => {
    const provider = await createProvider(SELLER, { type: "service" });
    const service = await createService(provider.id);

    const booked = await api()
      .post("/api/bookings")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({
        providerId: provider.id,
        serviceId: service.id,
        bookingDate: "2030-01-15",
        timeSlot: "10:00 - 12:00",
        address: "House 1, Lahore",
      });
    expect(booked.status).toBe(201);
    expect(booked.body).toMatchObject({ status: "pending", serviceName: service.name });

    const confirmed = await api()
      .patch(`/api/bookings/${booked.body.id}`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ status: "confirmed" });
    expect(confirmed.body.status).toBe("confirmed");

    const mine = await api().get("/api/my-bookings").set(SIGNED_IN_AS, CUSTOMER);
    expect(mine.body).toHaveLength(1);
  });

  it("refuses a booking for a day that has passed but accepts today", async () => {
    const provider = await createProvider(SELLER, { type: "service" });
    const service = await createService(provider.id);
    const book = (bookingDate: string) =>
      api().post("/api/bookings").set(SIGNED_IN_AS, CUSTOMER).send({
        providerId: provider.id,
        serviceId: service.id,
        bookingDate,
        timeSlot: "10:00 - 12:00",
        address: "House 1, Lahore",
      });

    const past = await book("2020-01-15T04:00:00.000Z");
    expect(past.status).toBe(400);
    expect(past.body.error).toMatch(/past/);

    const ancient = await book("0999-06-01T09:00:00.000Z");
    expect(ancient.status).toBe(400);

    const today = await book(new Date().toISOString());
    expect(today.status).toBe(201);
  });

  it("lets the customer cancel but not confirm", async () => {
    const provider = await createProvider(SELLER, { type: "service" });
    const service = await createService(provider.id);
    const booked = await api()
      .post("/api/bookings")
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({
        providerId: provider.id,
        serviceId: service.id,
        bookingDate: "2030-01-15",
        timeSlot: "10:00 - 12:00",
        address: "House 1, Lahore",
      });
    const url = `/api/bookings/${booked.body.id}`;

    expect((await api().patch(url).set(SIGNED_IN_AS, CUSTOMER).send({ status: "confirmed" })).status).toBe(401);
    expect((await api().patch(url).set(SIGNED_IN_AS, CUSTOMER).send({ status: "cancelled" })).body.status).toBe(
      "cancelled",
    );
  });
});
