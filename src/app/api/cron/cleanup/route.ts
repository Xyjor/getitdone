import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";

const DAY_MS = 24 * 60 * 60 * 1000;

function isAuthorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * GET /api/cron/cleanup: run daily by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Removes expired sessions, stale rate-limit counters
 * and demo accounts older than a day (their lists and tasks cascade).
 */
export const GET = route(async (req) => {
  if (!isAuthorized(req.headers.get("authorization"))) throw new ApiError(401, "Unauthorized");

  const now = Date.now();
  const [sessions, rateLimits, demoUsers] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - DAY_MS) } } }),
    db.user.deleteMany({ where: { isDemo: true, createdAt: { lt: new Date(now - DAY_MS) } } }),
  ]);

  return NextResponse.json({
    deleted: { sessions: sessions.count, rateLimits: rateLimits.count, demoUsers: demoUsers.count },
  });
});
