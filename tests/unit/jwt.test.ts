import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

describe("session JWTs", () => {
  it("round-trips the user and session ids", async () => {
    const token = await signSessionToken("user_123", "sess_456");
    await expect(verifySessionToken(token)).resolves.toEqual({ userId: "user_123", sessionId: "sess_456" });
  });

  it("rejects an otherwise valid token that has no session id (pre-upgrade tokens)", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_123")
      .setIssuer("getitdone")
      .setAudience("getitdone-web")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("rejects missing and garbage tokens", async () => {
    await expect(verifySessionToken(undefined)).resolves.toBeNull();
    await expect(verifySessionToken("not.a.jwt")).resolves.toBeNull();
  });

  it("rejects a token whose payload was tampered with", async () => {
    const token = await signSessionToken("user_123", "sess_456");
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin" })).toString("base64url");
    await expect(verifySessionToken(`${header}.${forgedPayload}.${signature}`)).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_123")
      .setIssuer("getitdone")
      .setAudience("getitdone-web")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-completely-different-secret-of-32-chars!"));
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_123")
      .setIssuer("getitdone")
      .setAudience("getitdone-web")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });
});
