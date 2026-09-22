import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Fixed-window rate limiting stored in Postgres: no extra service, so it stays free.

/**
 * Keys are HMAC-SHA256'd with a server secret, so the table never contains raw IPs or emails
 * (and, unlike a plain hash, they can't be reversed by trying every IPv4 address).
 */
export const hashKey = (key: string) =>
  createHmac("sha256", process.env.JWT_SECRET ?? "")
    .update(key)
    .digest("hex");

type Options = { limit: number; windowSec: number; message?: string };

/**
 * Counts one hit for `key` and throws 429 (with Retry-After) once the limit is exceeded.
 * A single atomic upsert, so concurrent requests can't slip past the limit.
 */
export async function rateLimit(key: string, { limit, windowSec, message }: Options) {
  // Timestamps come from the app's clock (UTC Dates) rather than Postgres now(), so they match
  // how the rest of the app reads and compares this column regardless of the DB's time zone.
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${hashKey(key)}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < ${windowCutoff} THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < ${windowCutoff} THEN ${now}
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count", "windowStart"`;

  const { count, windowStart } = rows[0]!;
  if (count > limit) throw tooManyRequests(windowStart, windowSec, message);
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
  /** Counted before the password check (so parallel guesses can't race it) and reset on success. */
  loginAttemptsPerEmail: { limit: 5, windowSec: 15 * 60 },
  registerPerIp: { limit: 5, windowSec: 60 * 60 },
  demoPerIp: { limit: 10, windowSec: 60 * 60 },
  sensitivePerUser: { limit: 5, windowSec: 15 * 60 },
  invitesPerUser: { limit: 20, windowSec: 60 * 60 },
} satisfies Record<string, Options>;
