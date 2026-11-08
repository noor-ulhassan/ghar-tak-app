import { sql } from "drizzle-orm";
import { boolean, index, jsonb, numeric, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable(
  "orders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    customerId: varchar("customer_id").notNull(),
    customerName: varchar("customer_name", { length: 255 }),
    providerId: varchar("provider_id").notNull(),
    providerName: varchar("provider_name", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull().default("cash_on_delivery"),
    deliveryAddress: text("delivery_address"),
    notes: text("notes"),
    items: jsonb("items").notNull().default([]),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
    couponCode: varchar("coupon_code", { length: 50 }),
    statusHistory: jsonb("status_history").notNull().default([]),
    // True when placing the order took its items out of stock, so a cancel puts them back.
    // Orders placed before stock tracking stay false and never change stock.
    stockReserved: boolean("stock_reserved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_orders_customer_id").on(table.customerId),
    index("idx_orders_provider_id").on(table.providerId),
  ],
);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
