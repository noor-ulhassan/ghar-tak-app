import { db, pool } from "./index";
import { eq, inArray } from "drizzle-orm";
import {
  usersTable,
  providersTable,
  productsTable,
  servicesTable,
  reviewsTable,
  ordersTable,
  subscriptionsTable,
  couponsTable,
  bookingsTable,
} from "./schema";

const img = (w = 600, h = 400) => `https://placehold.co/${w}x${h}.png`;

async function seed() {
  console.log("Seeding demo data…");

  await db
    .insert(usersTable)
    .values([
      {
        id: "demo-store-owner",
        email: "store@ghartak.dev",
        firstName: "Store",
        lastName: "Owner",
        profileImageUrl: img(100, 100),
      },
      {
        id: "demo-service-owner",
        email: "service@ghartak.dev",
        firstName: "Service",
        lastName: "Owner",
        profileImageUrl: img(100, 100),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(providersTable)
    .values([
      {
        id: "store1",
        userId: "demo-store-owner",
        name: "Al-Baraka General Store",
        type: "store",
        category: "Grocery",
        description:
          "Your trusted neighbourhood grocery store — fresh produce, dairy, and daily essentials at great prices.",
        address: "Main Market, Gulberg III, Lahore",
        phone: "+92 300 1234567",
        email: "store1@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sat 9am-10pm",
        deliveryRadiusKm: "5",
        lat: "31.5204",
        lng: "74.3587",
        rating: "4.5",
        reviewCount: 128,
        planId: "growth",
        isVerified: true,
      },
      {
        id: "store2",
        userId: "demo-store-owner",
        name: "Pak Electronics Hub",
        type: "store",
        category: "Electronics",
        description:
          "Latest mobiles, laptops, accessories and same-day repairs. Authorised dealer for major brands.",
        address: "Electronics Market, Saddar, Karachi",
        phone: "+92 21 35671234",
        email: "store2@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sat 10am-9pm",
        deliveryRadiusKm: "10",
        lat: "24.8607",
        lng: "67.0011",
        rating: "4.8",
        reviewCount: 96,
        planId: "growth",
        isVerified: true,
      },
      {
        id: "store3",
        userId: "demo-store-owner",
        name: "Bundu Khan Restaurant",
        type: "restaurant",
        category: "Restaurant",
        description:
          "Authentic Lahori cuisine — biryani, karahi, and seekh kababs made fresh daily.",
        address: "MM Alam Road, Gulberg, Lahore",
        phone: "+92 42 35751234",
        email: "store3@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Daily 12pm-12am",
        deliveryRadiusKm: "8",
        lat: "31.5497",
        lng: "74.3436",
        rating: "4.3",
        reviewCount: 342,
        planId: "starter",
      },
      {
        id: "store4",
        userId: "demo-store-owner",
        name: "Khaddi Fabrics & Fashion",
        type: "store",
        category: "Fashion",
        description:
          "Premium lawn, linen, silk, and ready-to-wear collections. Latest Pakistani fashion trends.",
        address: "Jinnah Super Market, F-7, Islamabad",
        phone: "+92 51 2654321",
        email: "store4@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sun 11am-9pm",
        deliveryRadiusKm: "15",
        lat: "33.7215",
        lng: "73.0433",
        rating: "4.6",
        reviewCount: 74,
        planId: "starter",
      },
      {
        id: "store5",
        userId: "demo-store-owner",
        name: "Gul Masala Centre",
        type: "store",
        category: "Grocery",
        description:
          "Freshly ground spices, whole masalas, and exotic ingredients sourced directly from farms.",
        address: "Akbari Mandi, Lahore",
        phone: "+92 300 9876543",
        email: "store5@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sat 8am-9pm",
        deliveryRadiusKm: "6",
        lat: "31.5890",
        lng: "74.3313",
        rating: "4.9",
        reviewCount: 61,
        planId: "growth",
      },
      {
        id: "sp1",
        userId: "demo-service-owner",
        name: "Ustad Raza Plumbing",
        type: "service",
        category: "plumber",
        description:
          "Experienced plumber serving Lahore for over 15 years. Pipe repairs, leakage fixing, and bathroom fitting.",
        address: "Gulberg, Lahore",
        phone: "+92 321 5551234",
        email: "sp1@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sat 9am-7pm",
        deliveryRadiusKm: "10",
        lat: "31.5204",
        lng: "74.3587",
        rating: "4.7",
        reviewCount: 83,
        planId: "pro",
        isVerified: true,
      },
      {
        id: "sp2",
        userId: "demo-service-owner",
        name: "SafaaKar Cleaning Services",
        type: "service",
        category: "cleaner",
        description:
          "Professional home and office cleaning across Karachi. Deep cleaning, sofa cleaning, and carpet washing.",
        address: "Gulshan-e-Iqbal, Karachi",
        phone: "+92 333 2221100",
        email: "sp2@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Available 7 days",
        deliveryRadiusKm: "12",
        lat: "24.8607",
        lng: "67.0011",
        rating: "4.9",
        reviewCount: 150,
        planId: "growth",
        isVerified: true,
      },
      {
        id: "sp3",
        userId: "demo-service-owner",
        name: "Noor Beauty Salon",
        type: "service",
        category: "hairdresser",
        description:
          "Ladies salon offering haircuts, colouring, mehndi, bridal packages, and facials.",
        address: "F-10 Markaz, Islamabad",
        phone: "+92 51 8432100",
        email: "sp3@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Tue-Sun 11am-8pm",
        deliveryRadiusKm: "7",
        lat: "33.7215",
        lng: "73.0433",
        rating: "4.6",
        reviewCount: 210,
        planId: "growth",
      },
      {
        id: "sp4",
        userId: "demo-service-owner",
        name: "Faisal Auto Workshop",
        type: "service",
        category: "car_repair",
        description:
          "Reliable car servicing, engine repair, and denting/painting for all makes and models.",
        address: "Saddar, Rawalpindi",
        phone: "+92 51 5567890",
        email: "sp4@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sat 9am-6pm",
        deliveryRadiusKm: "20",
        lat: "33.5651",
        lng: "73.0169",
        rating: "4.4",
        reviewCount: 55,
        planId: "starter",
      },
      {
        id: "sp5",
        userId: "demo-service-owner",
        name: "Smart Fix PK",
        type: "service",
        category: "tech_repair",
        description:
          "Expert repairs for iPhones, Android phones, laptops, and tablets. Original parts only.",
        address: "Liberty Market, Lahore",
        phone: "+92 300 4445678",
        email: "sp5@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Sat 11am-9pm",
        deliveryRadiusKm: "8",
        lat: "31.5497",
        lng: "74.3436",
        rating: "4.8",
        reviewCount: 132,
        planId: "pro",
        isVerified: true,
      },
      {
        id: "sp6",
        userId: "demo-service-owner",
        name: "Rafiq Handyman Services",
        type: "service",
        category: "general_repair",
        description:
          "All-around handyman for home repairs — painting, carpentry, minor electrical, and mounting.",
        address: "PECHS, Karachi",
        phone: "+92 321 7788990",
        email: "sp6@ghartak.dev",
        avatarUrl: img(),
        coverUrl: img(1200, 400),
        isOpen: true,
        openingHours: "Mon-Fri 9am-6pm",
        deliveryRadiusKm: "10",
        lat: "24.8607",
        lng: "67.05",
        rating: "4.5",
        reviewCount: 41,
        planId: "starter",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(productsTable)
    .values([
      { id: "prod1", providerId: "store1", name: "Desi Mangoes (1 kg)", description: "Fresh seasonal mangoes.", price: "350", stock: 50, category: "Produce", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod2", providerId: "store1", name: "Fresh Milk (1 litre)", description: "Full-cream pasteurised milk.", price: "180", stock: 40, category: "Dairy", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod9", providerId: "store1", name: "Naan Bread (6 pcs)", description: "Freshly baked naan from local oven.", price: "120", stock: 30, category: "Bakery", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod10", providerId: "store1", name: "Shan Biryani Masala Pack", description: "Signature biryani masala mix.", price: "95", stock: 100, category: "Pantry", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod3", providerId: "store2", name: "Wireless Earbuds (TWS)", description: "Bluetooth earbuds with charging case.", price: "8500", stock: 25, category: "Audio", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod4", providerId: "store2", name: "Fast Charger 65W", description: "USB-C 65W fast charger.", price: "1800", stock: 60, category: "Accessories", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod11", providerId: "store2", name: "Power Bank 20000mAh", description: "High-capacity portable charger.", price: "4500", stock: 35, category: "Accessories", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod12", providerId: "store2", name: "Laptop Sleeve 15\"", description: "Padded laptop sleeve.", price: "2200", stock: 20, category: "Accessories", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod5", providerId: "store3", name: "Chicken Biryani (1 plate)", description: "Classic Lahori chicken biryani.", price: "450", stock: 50, category: "Rice Dishes", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod6", providerId: "store3", name: "Karahi Gosht (half kg)", description: "Mutton karahi with naan.", price: "1800", stock: 20, category: "Main Course", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod13", providerId: "store3", name: "Seekh Kabab Platter (10 pcs)", description: "Char-grilled seekh kababs.", price: "950", stock: 30, category: "BBQ", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod14", providerId: "store3", name: "Rooh Afza Drink", description: "Refreshing rose syrup drink.", price: "120", stock: 80, category: "Beverages", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod15", providerId: "store4", name: "Lawn Fabric (2.5 metres)", description: "Premium lawn fabric.", price: "2800", stock: 40, category: "Fabric", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod16", providerId: "store4", name: "Silk Dupatta", description: "Elegant embroidered silk dupatta.", price: "3500", stock: 15, category: "Accessories", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod17", providerId: "store5", name: "Kalonji (Nigella Seeds) 100g", description: "Freshly packed kalonji seeds.", price: "320", stock: 70, category: "Spices", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod18", providerId: "store5", name: "Saffron (Kesar) 1g", description: "Premium saffron strands.", price: "3200", stock: 10, category: "Spices", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod7", providerId: "sp1", name: "Pipe Wrench (10 inch)", description: "Heavy-duty pipe wrench.", price: "2200", stock: 12, category: "Tools", imageUrl: img(300, 200), isAvailable: true },
      { id: "prod8", providerId: "sp5", name: "Tempered Glass Screen Protector", description: "9H tempered glass for phones.", price: "350", stock: 100, category: "Accessories", imageUrl: img(300, 200), isAvailable: true },
    ])
    .onConflictDoNothing();

  await db
    .insert(servicesTable)
    .values([
      { id: "svc1", providerId: "sp1", name: "Leak Repair", description: "Fix pipe and tap leaks on site.", priceRange: "PKR 500 - 1,500", duration: "1-2 hours", category: "plumber", isAvailable: true },
      { id: "svc2", providerId: "sp1", name: "Bathroom Fitting", description: "Install showers, basins, and fittings.", priceRange: "PKR 3,000 - 8,000", duration: "3-4 hours", category: "plumber", isAvailable: true },
      { id: "svc3", providerId: "sp2", name: "Home Deep Cleaning", description: "Full-home deep cleaning service.", priceRange: "PKR 5,000 - 15,000", duration: "4-6 hours", category: "cleaner", isAvailable: true },
      { id: "svc4", providerId: "sp2", name: "Sofa & Carpet Wash", description: "Professional sofa and carpet washing.", priceRange: "PKR 2,500 - 7,000", duration: "2-3 hours", category: "cleaner", isAvailable: true },
      { id: "svc5", providerId: "sp3", name: "Haircut & Styling", description: "Modern cuts and styling.", priceRange: "PKR 1,000 - 3,000", duration: "1 hour", category: "hairdresser", isAvailable: true },
      { id: "svc6", providerId: "sp3", name: "Bridal Mehndi Package", description: "Complete bridal mehndi design.", priceRange: "PKR 8,000 - 25,000", duration: "3-5 hours", category: "beauty", isAvailable: true },
      { id: "svc7", providerId: "sp4", name: "Engine Service", description: "Full engine tune-up and oil change.", priceRange: "PKR 4,000 - 12,000", duration: "2-4 hours", category: "car_repair", isAvailable: true },
      { id: "svc8", providerId: "sp4", name: "Denting & Painting", description: "Panel repair and respray.", priceRange: "PKR 10,000 - 50,000", duration: "1-2 days", category: "car_repair", isAvailable: true },
      { id: "svc9", providerId: "sp5", name: "Phone Screen Replacement", description: "Original display replacement.", priceRange: "PKR 3,500 - 15,000", duration: "1-2 hours", category: "tech_repair", isAvailable: true },
      { id: "svc10", providerId: "sp5", name: "Laptop Diagnostics", description: "Hardware diagnostics and repair.", priceRange: "PKR 1,500 - 6,000", duration: "1 day", category: "tech_repair", isAvailable: true },
      { id: "svc11", providerId: "sp6", name: "House Painting", description: "Interior/exterior painting services.", priceRange: "PKR 15,000 - 60,000", duration: "2-5 days", category: "general_repair", isAvailable: true },
      { id: "svc12", providerId: "sp6", name: "Furniture Assembly", description: "Flat-pack and custom furniture assembly.", priceRange: "PKR 800 - 3,000", duration: "1-3 hours", category: "general_repair", isAvailable: true },
    ])
    .onConflictDoNothing();

  await db
    .insert(reviewsTable)
    .values([
      { id: "rev1", providerId: "store1", customerId: "demo-customer-1", customerName: "Ayesha Khan", rating: 5, comment: "Great prices and very fresh produce. Highly recommended!", reply: "Thank you Ayesha! See you soon." },
      { id: "rev2", providerId: "store1", customerId: "demo-customer-2", customerName: "Bilal Ahmed", rating: 4, comment: "Good store, delivery took a bit longer than expected.", reply: null },
      { id: "rev3", providerId: "store2", customerId: "demo-customer-3", customerName: "Fatima Noor", rating: 5, comment: "Got my laptop repaired same day. Great service!", reply: "Thanks Fatima! We aim for speed." },
      { id: "rev4", providerId: "sp1", customerId: "demo-customer-4", customerName: "Imran Qureshi", rating: 5, comment: "Fixed our kitchen leak within the hour. Very professional.", reply: null },
      { id: "rev5", providerId: "sp5", customerId: "demo-customer-5", customerName: "Zara Malik", rating: 4, comment: "Screen replaced, looks brand new. Slightly pricey but worth it.", reply: null },
      { id: "rev6", providerId: "store3", customerId: "demo-customer-6", customerName: "Hassan Raza", rating: 5, comment: "Best biryani in Lahore, hands down!", reply: "JazakAllah! See you again." },
    ])
    .onConflictDoNothing();

  await db
    .insert(ordersTable)
    .values([
      {
        id: "order1",
        customerId: "demo-customer-1",
        customerName: "Ayesha Khan",
        providerId: "store1",
        providerName: "Al-Baraka General Store",
        status: "delivered",
        total: "710",
        paymentMethod: "cash_on_delivery",
        deliveryAddress: "House 12, Block B, Gulberg III, Lahore",
        notes: "Please leave with the guard.",
        deliveryFee: "100",
        discount: "100",
        couponCode: "WELCOME10",
        statusHistory: [
          { status: "pending", at: "2026-10-18T10:00:00.000Z" },
          { status: "confirmed", at: "2026-10-18T10:05:00.000Z" },
          { status: "processing", at: "2026-10-18T10:20:00.000Z" },
          { status: "shipped", at: "2026-10-18T10:45:00.000Z" },
          { status: "delivered", at: "2026-10-18T11:10:00.000Z" },
        ] as unknown as object[],
        items: [
          { id: "prod1", name: "Desi Mangoes (1 kg)", price: "350", quantity: 1 },
          { id: "prod2", name: "Fresh Milk (1 litre)", price: "180", quantity: 2 },
        ] as unknown as object[],
      },
      {
        id: "order2",
        customerId: "demo-customer-4",
        customerName: "Imran Qureshi",
        providerId: "store3",
        providerName: "Bundu Khan Restaurant",
        status: "shipped",
        total: "1500",
        paymentMethod: "cash_on_delivery",
        deliveryAddress: "Office 4, MM Alam Road, Lahore",
        notes: "",
        deliveryFee: "100",
        discount: "0",
        statusHistory: [
          { status: "pending", at: "2026-10-21T13:00:00.000Z" },
          { status: "confirmed", at: "2026-10-21T13:03:00.000Z" },
          { status: "processing", at: "2026-10-21T13:25:00.000Z" },
          { status: "shipped", at: "2026-10-21T13:50:00.000Z" },
        ] as unknown as object[],
        items: [
          { id: "prod5", name: "Chicken Biryani (1 plate)", price: "450", quantity: 2 },
          { id: "prod13", name: "Seekh Kabab Platter (10 pcs)", price: "950", quantity: 1 },
        ] as unknown as object[],
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(couponsTable)
    .values([
      {
        id: "coupon1",
        code: "WELCOME10",
        description: "10% off your first order over PKR 500",
        type: "percent",
        value: "10",
        minOrder: "500",
        maxDiscount: "300",
        active: true,
      },
      {
        id: "coupon2",
        code: "SAVE500",
        description: "Flat PKR 500 off orders over PKR 2,000",
        type: "fixed",
        value: "500",
        minOrder: "2000",
        active: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(bookingsTable)
    .values([
      {
        id: "booking1",
        customerId: "demo-customer-4",
        customerName: "Imran Qureshi",
        providerId: "sp1",
        providerName: "Ustad Raza Plumbing",
        serviceId: "svc1",
        serviceName: "Leak Repair",
        priceRange: "PKR 500 - 1,500",
        bookingDate: new Date("2026-10-24T09:00:00.000Z"),
        timeSlot: "10:00 - 11:00",
        address: "House 8, Block C, Gulberg III, Lahore",
        notes: "Kitchen sink pipe is leaking.",
        status: "confirmed",
      },
    ])
    .onConflictDoNothing();

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await db
    .insert(subscriptionsTable)
    .values([
      { id: "sub1", providerId: "store1", planId: "growth", planName: "Growth", status: "active", currentPeriodEnd: periodEnd },
      { id: "sub2", providerId: "sp1", planId: "pro", planName: "Pro", status: "active", currentPeriodEnd: periodEnd },
    ])
    .onConflictDoNothing();

  // Refresh demo rows that may pre-date newer columns
  await db
    .update(providersTable)
    .set({ isVerified: true })
    .where(inArray(providersTable.id, ["store1", "store2", "sp1", "sp2", "sp5"]));

  await db
    .update(ordersTable)
    .set({
      status: "delivered",
      total: "710",
      deliveryFee: "100",
      discount: "100",
      couponCode: "WELCOME10",
      statusHistory: [
        { status: "pending", at: "2026-10-18T10:00:00.000Z" },
        { status: "confirmed", at: "2026-10-18T10:05:00.000Z" },
        { status: "processing", at: "2026-10-18T10:20:00.000Z" },
        { status: "shipped", at: "2026-10-18T10:45:00.000Z" },
        { status: "delivered", at: "2026-10-18T11:10:00.000Z" },
      ] as unknown as object[],
    })
    .where(eq(ordersTable.id, "order1"));

  await db
    .update(ordersTable)
    .set({
      status: "shipped",
      deliveryFee: "100",
      statusHistory: [
        { status: "pending", at: "2026-10-21T13:00:00.000Z" },
        { status: "confirmed", at: "2026-10-21T13:03:00.000Z" },
        { status: "processing", at: "2026-10-21T13:25:00.000Z" },
        { status: "shipped", at: "2026-10-21T13:50:00.000Z" },
      ] as unknown as object[],
    })
    .where(eq(ordersTable.id, "order2"));

  console.log("Seed complete.");
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
