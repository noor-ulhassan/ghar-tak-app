import { beforeEach, describe, expect, it } from "vitest";
import { SIGNED_IN_AS, api, createProvider, resetDatabase } from "../test/helpers";

describe("profile", () => {
  beforeEach(resetDatabase);

  it("requires sign-in", async () => {
    const res = await api().get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("creates the profile on first visit and saves a new name", async () => {
    const first = await api().get("/api/auth/me").set(SIGNED_IN_AS, "user-1");
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ id: "user-1", isProvider: false });

    const renamed = await api()
      .patch("/api/auth/me")
      .set(SIGNED_IN_AS, "user-1")
      .send({ name: "Ayesha Khan" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Ayesha Khan");
  });

  it("saves a phone number without touching the name", async () => {
    await api().patch("/api/auth/me").set(SIGNED_IN_AS, "user-1").send({ name: "Ayesha Khan" });
    const res = await api()
      .patch("/api/auth/me")
      .set(SIGNED_IN_AS, "user-1")
      .send({ phone: "0300 1234567" });
    expect(res.body).toMatchObject({ name: "Ayesha Khan", phone: "0300 1234567" });

    const me = await api().get("/api/auth/me").set(SIGNED_IN_AS, "user-1");
    expect(me.body.phone).toBe("0300 1234567");
  });

  it("reports store owners as providers after an update", async () => {
    await createProvider("user-1");
    const res = await api().patch("/api/auth/me").set(SIGNED_IN_AS, "user-1").send({ name: "Owner" });
    expect(res.body.isProvider).toBe(true);
  });

  it("rejects an overlong phone number", async () => {
    const res = await api()
      .patch("/api/auth/me")
      .set(SIGNED_IN_AS, "user-1")
      .send({ phone: "0".repeat(51) });
    expect(res.status).toBe(400);
  });
});
