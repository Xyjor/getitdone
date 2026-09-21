import { NextRequest } from "next/server";

/**
 * In-memory stand-in for the browser's cookie jar. Route handlers read and write cookies via
 * `next/headers`, which the tests mock to use this map (see `headersMock`).
 */
export const jar = new Map<string, string>();

export const headersMock = {
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
};

export const TEST_EMAIL_DOMAIN = "test.getitdone.local";

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_EMAIL_DOMAIN}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx: any) => Promise<Response>;

type CallOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  search?: Record<string, string>;
};

/** Invokes a route handler directly, like Next.js would, and parses the JSON response. */
export async function call<T = Record<string, unknown>>(handler: Handler, opts: CallOptions = {}) {
  const url = new URL("http://localhost:3000/api/test");
  for (const [k, v] of Object.entries(opts.search ?? {})) url.searchParams.set(k, v);

  const body =
    opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);

  const req = new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: { host: "localhost:3000", "content-type": "application/json", ...opts.headers },
    body,
  });

  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}
