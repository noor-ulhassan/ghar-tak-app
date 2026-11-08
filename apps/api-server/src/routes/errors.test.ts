import { describe, expect, it } from "vitest";
import { api } from "../test/helpers";

describe("error responses", () => {
  it("answers broken JSON with a JSON 400, not an HTML page", async () => {
    const res = await api()
      .post("/api/messages")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.type).toBe("application/json");
    expect(res.body).toEqual({ error: "Request body is not valid JSON" });
  });

  it("answers an unknown API route with a JSON 404", async () => {
    const res = await api().get("/api/no-such-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
