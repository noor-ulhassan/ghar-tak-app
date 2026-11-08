import { execSync } from "node:child_process";
import pg from "pg";
import { testDatabaseUrl } from "./database-url";

/** Creates the test database if needed and rebuilds its tables from the Drizzle schema. */
export default async function globalSetup() {
  const url = new URL(testDatabaseUrl());
  const name = decodeURIComponent(url.pathname.slice(1));
  // This database is wiped on every run, so never point it at real data.
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": the test database name must end in _test.`);
  }

  const serverUrl = new URL(url);
  serverUrl.pathname = "/postgres";
  const server = new pg.Client({ connectionString: serverUrl.toString() });
  await server.connect();
  const existing = await server.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!existing.rowCount) await server.query(`CREATE DATABASE "${name}"`);
  await server.end();

  // Start from an empty schema so drizzle-kit only creates tables and never asks about renames.
  const testDb = new pg.Client({ connectionString: url.toString() });
  await testDb.connect();
  await testDb.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await testDb.end();

  execSync("pnpm --filter @workspace/db run push-force", {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });
}
