import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import type { SessionDTO } from "@/lib/types";
import { describeUserAgent } from "@/lib/ui";

/** GET /api/account/sessions: the devices currently signed in to this account. */
export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });

  const sessions: SessionDTO[] = rows
    .map((s) => ({
      id: s.id,
      device: describeUserAgent(s.userAgent),
      current: s.id === user.sessionId,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current)); // this device first

  return NextResponse.json({ sessions });
});

/**
 * DELETE /api/account/sessions: signs out every *other* device in one query, including
 * sessions created after the settings page loaded.
 */
export const DELETE = route(async () => {
  const user = await requireUser();
  const { count } = await db.session.deleteMany({
    where: { userId: user.id, id: { not: user.sessionId } },
  });
  return NextResponse.json({ revoked: count });
});
