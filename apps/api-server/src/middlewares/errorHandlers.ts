import type { ErrorRequestHandler, RequestHandler } from "express";

/** Unknown /api routes get a JSON 404 instead of Express's HTML page. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

const CLIENT_ERROR_MESSAGES: Record<string, string> = {
  "entity.parse.failed": "Request body is not valid JSON",
  "entity.too.large": "Request body is too large",
};

/**
 * Last-resort handler: every error becomes a JSON `{ error }` body, like the
 * routes' own errors. Client errors (broken JSON, oversized body) keep their
 * 4xx status; anything else is logged and returned as a plain 500, so no
 * stack trace or server path ever reaches the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = Number(err?.status ?? err?.statusCode);
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: CLIENT_ERROR_MESSAGES[err.type] ?? "Bad request" });
    return;
  }

  req.log.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
};
