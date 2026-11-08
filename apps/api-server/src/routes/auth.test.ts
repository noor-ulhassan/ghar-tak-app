import { beforeEach, describe, expect, it } from "vitest";
import { SIGNED_IN_AS, api, resetDatabase } from "../test/helpers";

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
});
