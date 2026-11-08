import type { Request, Response } from "express";
import type { ZodType, ZodTypeDef } from "zod";

/**
 * Checks `req.body` against a schema. Fields the schema doesn't list are
 * dropped, so a request can only set what the schema allows. On failure it
 * sends a 400 naming each bad field and returns undefined, so a route can
 * stop with `if (!body) return;`.
 */
export function parseBody<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  req: Request,
  res: Response,
): T | undefined {
  const result = schema.safeParse(req.body);
  if (result.success) return result.data;

  res.status(400).json({
    error: "Invalid request",
    fields: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
  return undefined;
}
