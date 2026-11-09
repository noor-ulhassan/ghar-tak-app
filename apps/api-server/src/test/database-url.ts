import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

/**
 * Tests use their own database: the dev DATABASE_URL with "_test" added to the
 * database name (ghartak -> ghartak_test). TEST_DATABASE_URL overrides it.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  let devUrl = process.env.DATABASE_URL;
  try {
    const envFile = path.resolve(import.meta.dirname, "../../../../.env");
    devUrl = parse(readFileSync(envFile)).DATABASE_URL ?? devUrl;
  } catch {
    // No .env file (e.g. CI): fall back to DATABASE_URL from the environment.
  }
  if (!devUrl) {
    throw new Error("Set DATABASE_URL or TEST_DATABASE_URL to run the API tests.");
  }

  const url = new URL(devUrl);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}
