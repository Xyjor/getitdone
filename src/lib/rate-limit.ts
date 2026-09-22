import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Fixed-window rate limiting stored in Postgres: no extra service, so it stays free.

/** Keys are hashed so the table never contains raw IP addresses or emails. */
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

type Options = { limit: number; windowSec: number; message?: string };

/**
 * Counts one hit for `key` and throws 429 (with Retry-After) once the limit is exceeded.
 * A single atomic upsert, so concurrent requests can't slip past the limit.
 */
export async function rateLimit(key: string, { limit, windowSec, message }: Options) {
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${hashKey(key)}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSec}) THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSec}) THEN now()
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count", "windowStart"`;

  const { count, windowStart } = rows[0]!;
  if (count > limit) throw tooManyRequests(windowStart, windowSec, message);
}

/** Throws 429 if `key` has already used up its limit, without counting a new hit. */
export async function assertNotLimited(key: string, { limit, windowSec, message }: Options) {
  const row = await db.rateLimit.findUnique({ where: { key: hashKey(key) } });
  const windowActive = row && row.windowStart.getTime() + windowSec * 1000 > Date.now();
  if (row && windowActive && row.count >= limit) {
    throw tooManyRequests(row.windowStart, windowSec, message);
  }
}

function tooManyRequests(windowStart: Date, windowSec: number, message?: string) {
  const retryAfter = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowSec * 1000 - Date.now()) / 1000),
  );
  const minutes = Math.ceil(retryAfter / 60);
  return new ApiError(
    429,
    message ?? `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    undefined,
    { "Retry-After": String(retryAfter) },
  );
}

/** Forgets the count for `key` (e.g. after a successful login). */
export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key: hashKey(key) } });
}

export const LIMITS = {
  loginPerIp: { limit: 20, windowSec: 15 * 60 },
  loginFailuresPerEmail: { limit: 5, windowSec: 15 * 60 },
  registerPerIp: { limit: 5, windowSec: 60 * 60 },
  demoPerIp: { limit: 10, windowSec: 60 * 60 },
  sensitivePerUser: { limit: 5, windowSec: 15 * 60 },
} satisfies Record<string, Options>;
