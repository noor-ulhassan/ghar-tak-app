import { beforeEach, describe, expect, it } from "vitest";
import { db, messages } from "@workspace/db";
import { SIGNED_IN_AS, api, createProvider, createUser, resetDatabase } from "../test/helpers";

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

  it("signs store replies with the store name, never the owner's email", async () => {
    await createUser(SELLER, { firstName: null, lastName: null, email: "owner.private@example.test" });
    const store = await createProvider(SELLER, { name: "Noor General Store" });
    const sent = await api()
      .post(`/api/providers/${store.id}/messages`)
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({ content: "Is milk in stock?" });
    const conversationId = sent.body.conversationId;

    const reply = await api()
      .post(`/api/conversations/${conversationId}/messages`)
      .set(SIGNED_IN_AS, SELLER)
      .send({ content: "Yes, 20 packs" });
    expect(reply.body.message.senderName).toBe("Noor General Store");

    // A reply saved earlier with the owner's email is shown under the store name.
    await db.insert(messages).values({
      conversationId,
      senderId: SELLER,
      senderType: "provider",
      senderName: "owner.private@example.test",
      content: "Old reply",
    });
    const thread = await api()
      .get(`/api/conversations/${conversationId}/messages`)
      .set(SIGNED_IN_AS, CUSTOMER);
    const storeNames = thread.body
      .filter((m: { senderType: string }) => m.senderType === "provider")
      .map((m: { senderName: string }) => m.senderName);
    expect(storeNames).toEqual(["Noor General Store", "Noor General Store"]);
    expect(JSON.stringify(thread.body)).not.toContain("owner.private");
  });

  it("shows the store's current name and logo in existing chats after a rename", async () => {
    const store = await createProvider(SELLER, { name: "Old Name Mart" });
    await api()
      .post(`/api/providers/${store.id}/messages`)
      .set(SIGNED_IN_AS, CUSTOMER)
      .send({ content: "hi" });
    await api()
      .patch("/api/providers/me")
      .set(SIGNED_IN_AS, SELLER)
      .send({ name: "New Name Mart", avatarUrl: "https://img.example.test/new.png" });

    const inbox = await api().get("/api/conversations").set(SIGNED_IN_AS, CUSTOMER);
    expect(inbox.body[0]).toMatchObject({
      providerName: "New Name Mart",
      providerAvatar: "https://img.example.test/new.png",
    });
  });

  it("accepts a contact form message without sign-in", async () => {
    const res = await api()
      .post("/api/messages")
      .send({ name: "Ali", email: "ali@example.test", message: "Hello" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
