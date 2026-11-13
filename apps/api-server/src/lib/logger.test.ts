import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logLines = vi.hoisted(() => [] as string[]);

// The app's real error serializer, writing into memory instead of the console.
vi.mock("./logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./logger")>();
  const { default: pino } = await import("pino");
  const sink = new Writable({
    write(chunk, _encoding, done) {
      logLines.push(String(chunk));
      done();
    },
  });
  return { ...actual, logger: pino({ level: "info", serializers: { err: actual.serializeError } }, sink) };
});

import { pool } from "@workspace/db";
import { api, createProvider, resetDatabase } from "../test/helpers";

describe("error logs", () => {
  beforeEach(async () => {
    await resetDatabase();
    logLines.length = 0;
  });
  afterEach(async () => {
    await pool.query(
      "ALTER TABLE IF EXISTS providers RENAME COLUMN delivery_radius_km_gone TO delivery_radius_km",
    ).catch(() => {});
  });

  it("keep a failed query's reason but not the customer's location", async () => {
    await createProvider("seller-1", { name: "A", lat: "31.5204000", lng: "74.3587000" });
    // Break the near-me query the way a database outage or a missed migration would.
    await pool.query("ALTER TABLE providers RENAME COLUMN delivery_radius_km TO delivery_radius_km_gone");

    const res = await api().get("/api/providers?lat=31.5297123&lng=74.3512987");
    expect(res.status).toBe(500);

    const log = logLines.join("");
    expect(log).toContain("Failed query");
    expect(log).not.toContain("31.5297123");
    expect(log).not.toContain("74.3512987");
  });
});
