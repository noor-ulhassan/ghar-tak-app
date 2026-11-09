import { afterAll, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

// Replace Clerk with a header: a request with `x-test-user-id: <id>` is signed in as that user.
// Every Clerk account is "Sana Malik" with the email <id>@example.test.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  getAuth: (req: Request) => ({ userId: req.header("x-test-user-id") ?? null }),
  clerkClient: {
    users: {
      getUser: vi.fn(async (id: string) => ({
        id,
        firstName: "Sana",
        lastName: "Malik",
        primaryEmailAddressId: "email-1",
        emailAddresses: [{ id: "email-1", emailAddress: `${id}@example.test` }],
        imageUrl: "https://img.example.test/sana.png",
      })),
    },
  },
}));

afterAll(async () => {
  const { pool } = await import("@workspace/db");
  await pool.end();
});
