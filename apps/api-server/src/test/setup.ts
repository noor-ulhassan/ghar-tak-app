import { afterAll, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

// Replace Clerk with a header: a request with `x-test-user-id: <id>` is signed in as that user.
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  getAuth: (req: Request) => ({ userId: req.header("x-test-user-id") ?? null }),
}));

afterAll(async () => {
  const { pool } = await import("@workspace/db");
  await pool.end();
});
