// When the server refuses a change (an order can't go back a step, a field is too long,
// the seller already has a store) its reply says why. Show that instead of a bare "failed".
export function apiErrorReason(error: unknown): string | undefined {
  const { status, data } = (error ?? {}) as { status?: number; data?: unknown };
  if (!status || status >= 500 || !data || typeof data !== "object") return undefined;

  const { error: message, fields } = data as {
    error?: unknown;
    fields?: { field?: string; message?: string }[];
  };
  if (Array.isArray(fields) && fields.length > 0) {
    return fields
      .map((f) => (f.field ? `${f.field}: ${f.message}` : f.message))
      .filter(Boolean)
      .join(". ");
  }
  return typeof message === "string" ? message : undefined;
}
