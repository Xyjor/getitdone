import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { UserDTO } from "@/lib/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./jwt";

/** How often `lastSeenAt` is refreshed. Avoids a database write on every request. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

/** Creates a Session row for this device and sets the signed session cookie. */
export async function createSession(userId: string, req?: Request) {
  const session = await db.session.create({
    data: {
      userId,
      userAgent: req?.headers.get("user-agent")?.slice(0, 512) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
    select: { id: true },
  });

  const token = await signSessionToken(userId, session.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript -> safe from XSS token theft
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // not sent on cross-site POSTs -> CSRF protection
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Logs out this device: the Session row is deleted, so the token stops working everywhere. */
export async function deleteSession() {
  const session = await getSession();
  if (session) await db.session.deleteMany({ where: { id: session.sessionId } });
  await clearSessionCookie();
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in user, or null. The JWT signature proves the cookie wasn't forged; the Session
 * row lookup proves it hasn't been revoked or expired. One query, cached per request.
 */
export const getCurrentUser = cache(async () => {
  const token = await getSession();
  if (!token) return null;

  const session = await db.session.findFirst({
    where: { id: token.sessionId, userId: token.userId, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      lastSeenAt: true,
      user: { select: { id: true, name: true, email: true, isDemo: true } },
    },
  });
  if (!session) return null;

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    // updateMany: if the session is revoked at this exact moment, don't throw.
    await db.session.updateMany({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  return { ...session.user, sessionId: session.id };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** What's safe to send to the browser (no session id). */
export function toUserDTO({ id, name, email, isDemo }: CurrentUser): UserDTO {
  return { id, name, email, isDemo };
}
