import request from "supertest";
import {
  couponsTable,
  db,
  ordersTable,
  pool,
  productsTable,
  providersTable,
  servicesTable,
  usersTable,
} from "@workspace/db";
import app from "../app";

/** Header that signs a test request in as a user (see setup.ts). */
export const SIGNED_IN_AS = "x-test-user-id";

export const api = () => request(app);

export async function resetDatabase() {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export async function createUser(id: string, fields: Partial<typeof usersTable.$inferInsert> = {}) {
  const [user] = await db
    .insert(usersTable)
    .values({ id, email: `${id}@example.test`, firstName: "Test", lastName: "User", ...fields })
    .returning();
  return user;
}

export async function createProvider(
  ownerId: string,
  fields: Partial<typeof providersTable.$inferInsert> = {},
) {
  const [provider] = await db
    .insert(providersTable)
    .values({ userId: ownerId, name: "Test Store", type: "store", planId: "starter", ...fields })
    .returning();
  return provider;
}

export async function createProduct(
  providerId: string,
  fields: Partial<typeof productsTable.$inferInsert> = {},
) {
  const [product] = await db
    .insert(productsTable)
    .values({ providerId, name: "Milk", price: "180", stock: 10, ...fields })
    .returning();
  return product;
}

export async function createService(
  providerId: string,
  fields: Partial<typeof servicesTable.$inferInsert> = {},
) {
  const [service] = await db
    .insert(servicesTable)
    .values({ providerId, name: "Leak Repair", priceRange: "PKR 500 - 1,500", ...fields })
    .returning();
  return service;
}

export async function createCoupon(fields: Partial<typeof couponsTable.$inferInsert> = {}) {
  const [coupon] = await db
    .insert(couponsTable)
    .values({ code: "WELCOME10", type: "percent", value: "10", ...fields })
    .returning();
  return coupon;
}

/** An order inserted directly, for tests that need one in a given state. */
export async function createOrder(
  customerId: string,
  providerId: string,
  fields: Partial<typeof ordersTable.$inferInsert> = {},
) {
  const [order] = await db
    .insert(ordersTable)
    .values({ customerId, providerId, providerName: "Test Store", total: "180", ...fields })
    .returning();
  return order;
}
