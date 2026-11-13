import { Platform } from "react-native";

export const getBaseUrl = () => {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // The Expo dev server on 8081 does not proxy /api; the API runs on 8000.
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return `http://${window.location.hostname}:8000`;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const domainHost = domain.split(":")[0];
    const isLocalHost =
      domainHost === "localhost" ||
      domainHost === "127.0.0.1" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(domainHost);
    // Local dev serves the API over plain HTTP on 8000, next to Metro on 8081.
    return isLocalHost ? `http://${domainHost}:8000` : `https://${domain}`;
  }
  return "";
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_TIMEOUT_MS = 15_000;

/**
 * GET a public Ghar Tak API path such as "/api/providers" and return its JSON.
 * Gives up after 15 seconds; `signal` (e.g. TanStack Query's) can cancel it sooner.
 * Throws ApiError: status 0 when the server can't be reached or took too long.
 */
export async function apiGet<T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const outer = options.signal;
  const cancel = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", cancel);

  try {
    let res: Response;
    try {
      res = await fetch(`${getBaseUrl()}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(
        timedOut
          ? "The Ghar Tak server is taking too long to answer. Please try again."
          : "Can't reach the Ghar Tak server. Check your connection and try again.",
        0,
      );
    }

    const data = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message = (data as { error?: string } | null)?.error;
      throw new ApiError(message || "Something went wrong. Please try again.", res.status);
    }
    if (data === null) {
      // The body could not be read: cut off by the timeout, or not JSON at all.
      throw new ApiError(
        timedOut
          ? "The Ghar Tak server is taking too long to answer. Please try again."
          : "The Ghar Tak server sent an answer the app couldn't read. Please try again.",
        0,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", cancel);
  }
}

async function postAI<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the Ghar Tak server. Check your connection and try again.", 0);
  }

  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new ApiError(data?.error || "Something went wrong. Please try again.", res.status);
  }
  return data as T;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function getChatbotResponse(message: string, history?: ChatTurn[]): Promise<string> {
  const data = await postAI<{ response: string }>("/api/ai/chatbot", { message, history });
  return data.response;
}

export async function analyzeImageForSearch(imageDataUri: string): Promise<string> {
  const data = await postAI<{ searchQuery: string }>("/api/ai/analyze-image", { imageDataUri });
  return (data.searchQuery ?? "").trim();
}
