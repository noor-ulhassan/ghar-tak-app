import { beforeEach, describe, expect, it } from "vitest";
import { SIGNED_IN_AS, api, createProvider, resetDatabase } from "../test/helpers";

const CUSTOMER = "customer-1";
const SELLER = "seller-1";

describe("chat and contact form", () => {
  beforeEach(resetDatabase);

  it("lets a customer message a store and the owner reply", async () => {
    const store = await createProvider(SELLER);

    const sent = await api()
      .post(`/api/providers/${store.id}/messages`)
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({ content: "Do you deliver to DHA?" });
    expect(sent.status).toBe(201);

    const inbox = await api().get("/api/conversations").set(SIGNED_IN_AS, SELLER);
    expect(inbox.body).toHaveLength(1);
    expect(inbox.body[0]).toMatchObject({ viewerRole: "provider", unreadCountProvider: 1 });

    const reply = await api()
      .post(`/api/conversations/${sent.body.conversationId}/messages`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ content: "Yes, within 5 km" });
    expect(reply.status).toBe(201);

    const thread = await api()
      .get(`/api/conversations/${sent.body.conversationId}/messages`)
      .set(SIGNED_IN_AS, CUSTOMER);
    expect(thread.body.map((m: { content: string }) => m.content)).toEqual([
      "Do you deliver to DHA?",
      "Yes, within 5 km",
    ]);

    const outsider = await api()
      .get(`/api/conversations/${sent.body.conversationId}/messages`)
      .set(SIGNED_IN_AS, "someone-else");
    expect(outsider.status).toBe(403);
  });

  it("accepts a contact form message without sign-in", async () => {
    const res = await api()
      .post("/api/messages")
      .send({ name: "Ali", email: "ali@example.test", message: "Hello" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
