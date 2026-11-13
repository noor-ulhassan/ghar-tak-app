import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// A failed database query reports the values it ran with ("params: ..." in its message,
// and a `params` field). Those can be a customer's location, phone or address, so logs
// keep the query and the database's reason, but not the values.
const QUERY_VALUES = /\nparams: [\s\S]*?(?=\n {4}at |$)/;

export function serializeError(err: unknown): unknown {
  if (!err || typeof err !== "object") return err;
  const serialized: Record<string, unknown> =
    err instanceof Error ? { ...pino.stdSerializers.err(err) } : { ...(err as Record<string, unknown>) };
  delete serialized.params;
  for (const key of ["message", "stack"]) {
    const text = serialized[key];
    if (typeof text === "string") serialized[key] = text.replace(QUERY_VALUES, "");
  }
  return serialized;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  serializers: { err: serializeError },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
