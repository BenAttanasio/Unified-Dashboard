import { FETCH_TIMEOUT_MS } from "./constants";

export class HttpError extends Error {
  status: number;
  rateLimited: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.rateLimited = status === 429;
  }
}

/**
 * Server-side fetch with timeout + JSON parsing. Throws HttpError on non-2xx so
 * callers can distinguish rate-limiting (429) from other failures.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new HttpError(
        res.status,
        `HTTP ${res.status} for ${stripQuery(url)}: ${body.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timeout after ${timeoutMs}ms for ${stripQuery(url)}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Hide any `?token=...` query string from logs/errors. */
export function stripQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}
