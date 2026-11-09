import { describe, expect, it } from "vitest";
import { api } from "../test/helpers";

describe("health", () => {
  it("reports that the API is up", async () => {
    const res = await api().get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
