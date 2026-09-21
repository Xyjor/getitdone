import type { ApiErrorBody } from "./types";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

/** Small fetch wrapper for our JSON API. Throws ApiClientError on non-2xx responses. */
export async function api<T = void>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });

  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
    // Session expired while using the app: full reload to the login page clears all cached data.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(
      res.status,
      data?.error.message ?? `Request failed (${res.status})`,
      data?.error.fieldErrors,
    );
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Today's date in the user's local timezone, as YYYY-MM-DD. */
export function localToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
