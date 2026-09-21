import { SignJWT, jwtVerify } from "jose";

// Kept free of database / Next.js imports so it can run anywhere (proxy, route handlers, tests).

export const SESSION_COOKIE = "getitdone_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const ISSUER = "getitdone";
const AUDIENCE = "getitdone-web";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { userId: string };

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Returns the session payload, or null if the token is missing, tampered with, or expired. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    return payload.sub ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}
