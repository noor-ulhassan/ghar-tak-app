import { Router, type IRouter, type Request, type Response } from "express";
import { db, bookingsTable, providersTable, servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { displayName, ensureUser } from "../lib/users";
import { requireAuth } from "./auth";

const router: IRouter = Router();

// Customers and providers are in Pakistan, so "today" follows Pakistan's calendar,
// not the server's. Returns the day as a number (YYYYMMDD) so every year compares correctly.
const karachiDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function calendarDay(date: Date): number {
  const parts = karachiDate.formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return part("year") * 10000 + part("month") * 100 + part("day");
}

function mapBooking(b: any) {
  return {
    id: b.id,
    customerId: b.customerId,
    customerName: b.customerName ?? null,
    providerId: b.providerId,
    providerName: b.providerName,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    priceRange: b.priceRange ?? null,
    bookingDate: b.bookingDate.toISOString(),
    timeSlot: b.timeSlot,
    address: b.address,
    notes: b.notes ?? null,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

// POST /api/bookings
router.post("/bookings", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const body = req.body as {
    providerId?: string;
    serviceId?: string;
    bookingDate?: string;
    timeSlot?: string;
    address?: string;
    notes?: string;
  };

  if (!body.providerId || !body.serviceId || !body.bookingDate || !body.timeSlot || !body.address) {
    res.status(400).json({ error: "providerId, serviceId, bookingDate, timeSlot and address are required" });
    return;
  }

  const bookingDate = new Date(body.bookingDate);
  if (Number.isNaN(bookingDate.getTime())) {
    res.status(400).json({ error: "bookingDate is invalid" });
    return;
  }
  if (calendarDay(bookingDate) < calendarDay(new Date())) {
    res.status(400).json({ error: "bookingDate can't be in the past" });
    return;
  }

  try {
    const [provider] = await db
      .select({ id: providersTable.id, name: providersTable.name, userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, body.providerId))
      .limit(1);

    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, body.serviceId))
      .limit(1);

    if (!service || service.providerId !== provider.id) {
      res.status(404).json({ error: "Service not found for this provider" });
      return;
    }

    if (!service.isAvailable) {
      res.status(409).json({ error: `${service.name} isn't available right now.` });
      return;
    }

    const customer = await ensureUser(clerkUserId);
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        customerId: clerkUserId,
        customerName: displayName(customer),
        providerId: provider.id,
        providerName: provider.name,
        serviceId: service.id,
        serviceName: service.name,
        priceRange: service.priceRange,
        bookingDate,
        timeSlot: body.timeSlot,
        address: body.address,
        notes: body.notes ?? null,
        status: "pending",
      })
      .returning();

    res.status(201).json(mapBooking(booking));
  } catch (err) {
    req.log.error({ err }, "POST /bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/my-bookings
router.get("/my-bookings", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const rows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.customerId, clerkUserId))
      .orderBy(bookingsTable.bookingDate);
    res.json(rows.map(mapBooking).reverse());
  } catch (err) {
    req.log.error({ err }, "GET /my-bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/provider-bookings
router.get("/provider-bookings", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  try {
    const [provider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, clerkUserId))
      .limit(1);

    if (!provider) {
      res.json([]);
      return;
    }

    const rows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.providerId, provider.id))
      .orderBy(bookingsTable.bookingDate);
    res.json(rows.map(mapBooking).reverse());
  } catch (err) {
    req.log.error({ err }, "GET /provider-bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/bookings/:bookingId
router.patch("/bookings/:bookingId", requireAuth, async (req: Request, res: Response) => {
  const clerkUserId = (req as any).clerkUserId as string;
  const { bookingId } = req.params as Record<string, string>;
  const { status } = req.body as { status: string };

  const allowed = ["pending", "confirmed", "completed", "cancelled"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const [provider] = await db
      .select({ userId: providersTable.userId })
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId))
      .limit(1);

    const isProvider = provider?.userId === clerkUserId;
    const isCustomer = booking.customerId === clerkUserId;

    if (!isProvider && !isCustomer) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (isCustomer && !isProvider) {
      if (status !== "cancelled") {
        res.status(401).json({ error: "Customers can only cancel bookings" });
        return;
      }
      if (booking.status === "completed" || booking.status === "cancelled") {
        res.status(400).json({ error: "This booking can no longer be cancelled" });
        return;
      }
    }

    if (isProvider && booking.status === "cancelled") {
      res.status(400).json({ error: "A cancelled booking cannot be changed" });
      return;
    }

    const [updated] = await db
      .update(bookingsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    res.json(mapBooking(updated));
  } catch (err) {
    req.log.error({ err }, "PATCH /bookings/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
