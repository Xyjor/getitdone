import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  call,
  headersMock,
  jar,
  randomIp,
  saveSession,
  TEST_EMAIL_DOMAIN,
  uniqueEmail,
  switchToSession,
} from "./helpers";

vi.mock("next/headers", () => headersMock);

const { db } = await import("@/lib/db");
const register = await import("@/app/api/auth/register/route");
const login = await import("@/app/api/auth/login/route");
const logout = await import("@/app/api/auth/logout/route");
const logoutAll = await import("@/app/api/auth/logout-all/route");
const { hashKey } = await import("@/lib/rate-limit");
const me = await import("@/app/api/auth/me/route");
const demo = await import("@/app/api/auth/demo/route");
const account = await import("@/app/api/account/route");
const password = await import("@/app/api/account/password/route");
const sessions = await import("@/app/api/account/sessions/route");
const sessionById = await import("@/app/api/account/sessions/[id]/route");
const cron = await import("@/app/api/cron/cleanup/route");
const lists = await import("@/app/api/lists/route");

type ErrorBody = { error: { message: string; fieldErrors?: Record<string, string[]> } };
type SessionRow = { id: string; device: string; current: boolean; createdAt: string; lastSeenAt: string };

const PASSWORD = "password123";
const demoUserIds: string[] = [];

async function signUp(label = "sec", ip = randomIp()) {
  jar.clear();
  const email = uniqueEmail(label);
  const res = await call<{ user: { id: string } }>(register.POST, {
    method: "POST",
    ip,
    body: { name: "Security Tester", email, password: PASSWORD },
  });
  expect(res.status).toBe(201);
  return { email, id: res.body.user.id, session: saveSession() };
}

/** Logs in again as the same user, producing a second, independent session ("another device"). */
async function loginAgain(email: string, pw = PASSWORD) {
  jar.clear();
  const res = await call(login.POST, { method: "POST", body: { email, password: pw } });
  expect(res.status).toBe(200);
  return saveSession();
}

const isLoggedIn = async () => (await call(me.GET)).status === 200;

afterAll(async () => {
  await db.user.deleteMany({
    where: { OR: [{ email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } }, { id: { in: demoUserIds } }] },
  });
  await db.$disconnect();
});

beforeEach(() => jar.clear());

describe("revocable sessions", () => {
  it("logging out invalidates the token itself, not just the cookie", async () => {
    const { session } = await signUp();
    const stolenCopy = new Map(session);

    await call(logout.POST, { method: "POST" });

    switchToSession(stolenCopy); // an attacker replays the old cookie
    expect(await isLoggedIn()).toBe(false);
  });

  it("log out everywhere ends every session of the user", async () => {
    const { email, session: laptop } = await signUp();
    const phone = await loginAgain(email);

    switchToSession(laptop);
    expect((await call(logoutAll.POST, { method: "POST" })).status).toBe(204);

    switchToSession(laptop);
    expect(await isLoggedIn()).toBe(false);
    switchToSession(phone);
    expect(await isLoggedIn()).toBe(false);
  });

  it("lists sessions with the current one marked, and can revoke another device", async () => {
    const { email, session: laptop } = await signUp();
    const phone = await loginAgain(email);

    switchToSession(laptop);
    const list = await call<{ sessions: SessionRow[] }>(sessions.GET);
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(2);
    expect(list.body.sessions.filter((s) => s.current)).toHaveLength(1);
    expect(list.body.sessions[0]!.device).toBe("Chrome on Windows");

    const other = list.body.sessions.find((s) => !s.current)!;
    expect((await call(sessionById.DELETE, { method: "DELETE", params: { id: other.id } })).status).toBe(204);

    switchToSession(phone);
    expect(await isLoggedIn()).toBe(false);
    switchToSession(laptop);
    expect(await isLoggedIn()).toBe(true);
  });

  it("signs out every other device in one step, including sessions the page never saw", async () => {
    const { email, session: laptop } = await signUp();
    const phone = await loginAgain(email);
    const tablet = await loginAgain(email); // created after the laptop loaded its list

    switchToSession(laptop);
    const res = await call<{ revoked: number }>(sessions.DELETE, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);

    expect(await isLoggedIn()).toBe(true);
    switchToSession(phone);
    expect(await isLoggedIn()).toBe(false);
    switchToSession(tablet);
    expect(await isLoggedIn()).toBe(false);
  });

  it("cannot revoke another user's session", async () => {
    await signUp("victim");
    const victimSessionId = (await call<{ sessions: SessionRow[] }>(sessions.GET)).body.sessions[0]!.id;
    const victim = saveSession();

    await signUp("attacker");
    const res = await call(sessionById.DELETE, { method: "DELETE", params: { id: victimSessionId } });
    expect(res.status).toBe(404);

    switchToSession(victim);
    expect(await isLoggedIn()).toBe(true);
  });

  it("rejects a session that has expired in the database", async () => {
    const { id } = await signUp();
    await db.session.updateMany({ where: { userId: id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await isLoggedIn()).toBe(false);
  });
});

describe("account", () => {
  it("updates the display name", async () => {
    await signUp();
    const res = await call<{ user: { name: string } }>(account.PATCH, {
      method: "PATCH",
      body: { name: "  New Name " },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("New Name");
  });

  it("changing the password signs out other devices but keeps this one", async () => {
    const { email, session: laptop } = await signUp();
    const phone = await loginAgain(email);

    switchToSession(laptop);
    const res = await call(password.POST, {
      method: "POST",
      body: { currentPassword: PASSWORD, newPassword: "a-brand-new-password" },
    });
    expect(res.status).toBe(204);
    expect(await isLoggedIn()).toBe(true);

    switchToSession(phone);
    expect(await isLoggedIn()).toBe(false);

    jar.clear();
    expect((await call(login.POST, { method: "POST", body: { email, password: PASSWORD } })).status).toBe(401);
    expect(
      (await call(login.POST, { method: "POST", body: { email, password: "a-brand-new-password" } })).status,
    ).toBe(200);
  });

  it("requires the correct current password to change it", async () => {
    await signUp();
    const res = await call<ErrorBody>(password.POST, {
      method: "POST",
      body: { currentPassword: "not-my-password", newPassword: "a-brand-new-password" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors?.currentPassword).toBeTruthy();
  });

  it("deletes the account and all its data after confirming the password", async () => {
    const { id, email } = await signUp();

    const wrong = await call(account.DELETE, { method: "DELETE", body: { password: "nope-nope" } });
    expect(wrong.status).toBe(400);

    const ok = await call(account.DELETE, { method: "DELETE", body: { password: PASSWORD } });
    expect(ok.status).toBe(204);
    expect(jar.size).toBe(0);
    expect(await db.user.findUnique({ where: { id } })).toBeNull();
    expect(await db.list.count({ where: { userId: id } })).toBe(0);
    expect((await call(login.POST, { method: "POST", body: { email, password: PASSWORD } })).status).toBe(401);
  });

  it("does not let demo accounts change their password, but lets them delete the account", async () => {
    const res = await call<{ user: { id: string } }>(demo.POST, { method: "POST" });
    demoUserIds.push(res.body.user.id);

    const change = await call(password.POST, {
      method: "POST",
      body: { currentPassword: "whatever-it-is", newPassword: "a-brand-new-password" },
    });
    expect(change.status).toBe(403);

    const del = await call(account.DELETE, { method: "DELETE", body: {} });
    expect(del.status).toBe(204);
  });
});

describe("rate limiting", () => {
  it("locks an email after 5 failed logins and says when to retry", async () => {
    const { email } = await signUp();
    jar.clear();

    for (let i = 0; i < 5; i++) {
      const res = await call(login.POST, { method: "POST", body: { email, password: "wrong-password" } });
      expect(res.status).toBe(401);
    }
    const locked = await call<ErrorBody>(login.POST, { method: "POST", body: { email, password: PASSWORD } });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("parallel guesses cannot get past the per-account limit", async () => {
    const { email } = await signUp();
    jar.clear();

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        call(login.POST, { method: "POST", body: { email, password: `parallel-guess-${i}` } }),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(5);
    expect(results.find((r) => r.status === 429)!.headers.get("retry-after")).toBeTruthy();
  });

  it("the limit resets once the window has passed", async () => {
    const ip = randomIp();
    for (let i = 0; i < 5; i++) await signUp("window", ip);
    const blocked = await call(register.POST, {
      method: "POST",
      ip,
      body: { name: "Blocked", email: uniqueEmail("window"), password: PASSWORD },
    });
    expect(blocked.status).toBe(429);

    // Pretend the hour-long window started 61 minutes ago.
    await db.rateLimit.update({
      where: { key: hashKey(`register:ip:${ip}`) },
      data: { windowStart: new Date(Date.now() - 61 * 60 * 1000) },
    });

    await signUp("window", ip);
    const row = await db.rateLimit.findUniqueOrThrow({ where: { key: hashKey(`register:ip:${ip}`) } });
    expect(row.count).toBe(1);
  });

  it("treats addresses in the same IPv6 /64 as one client", async () => {
    // A fresh /64 per run, so counts from earlier runs within the hour don't interfere.
    const prefix = `2001:db8:${Math.floor(Math.random() * 0xffff).toString(16)}:12`;
    for (let i = 1; i <= 5; i++) await signUp("v6", `${prefix}::${i}`);
    const res = await call(register.POST, {
      method: "POST",
      ip: `${prefix}::99`,
      body: { name: "Rotating", email: uniqueEmail("v6"), password: PASSWORD },
    });
    expect(res.status).toBe(429);
  });

  it("a successful login clears the failure count", async () => {
    const { email } = await signUp();
    jar.clear();

    for (let i = 0; i < 4; i++) {
      await call(login.POST, { method: "POST", body: { email, password: "wrong-password" } });
    }
    expect((await call(login.POST, { method: "POST", body: { email, password: PASSWORD } })).status).toBe(200);

    for (let i = 0; i < 4; i++) {
      await call(login.POST, { method: "POST", body: { email, password: "wrong-password" } });
    }
    expect((await call(login.POST, { method: "POST", body: { email, password: PASSWORD } })).status).toBe(200);
  });

  it("limits sign-ups to 5 per hour per IP address", async () => {
    const ip = randomIp();
    for (let i = 0; i < 5; i++) await signUp("burst", ip);

    const res = await call(register.POST, {
      method: "POST",
      ip,
      body: { name: "One too many", email: uniqueEmail("burst"), password: PASSWORD },
    });
    expect(res.status).toBe(429);

    // A different IP is unaffected.
    await signUp("burst", randomIp());
  });

  it("limits demo accounts to 10 per hour per IP address", async () => {
    const ip = randomIp();
    for (let i = 0; i < 10; i++) {
      const res = await call<{ user: { id: string } }>(demo.POST, { method: "POST", ip });
      expect(res.status).toBe(201);
      demoUserIds.push(res.body.user.id);
    }
    expect((await call(demo.POST, { method: "POST", ip })).status).toBe(429);
  });

  it("stores hashed keys, never raw emails or IPs", async () => {
    const ip = randomIp();
    const email = uniqueEmail("hash");
    await call(login.POST, { method: "POST", ip, body: { email, password: "whatever" } });
    const rows = await db.rateLimit.findMany({ where: { OR: [{ key: { contains: ip } }, { key: { contains: email } }] } });
    expect(rows).toEqual([]);
  });
});

describe("cleanup cron", () => {
  it("rejects requests without the cron secret", async () => {
    expect((await call(cron.GET)).status).toBe(401);
    expect((await call(cron.GET, { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });

  it("removes expired sessions and old demo accounts", async () => {
    const { id } = await signUp();
    await db.session.updateMany({ where: { userId: id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const oldDemo = await db.user.create({
      data: {
        name: "Old demo",
        email: `old-${Date.now()}@demo.getitdone.local`,
        passwordHash: "x",
        isDemo: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    demoUserIds.push(oldDemo.id);

    const res = await call(cron.GET, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(res.status).toBe(200);
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
    expect(await db.user.findUnique({ where: { id: oldDemo.id } })).toBeNull();
  });
});

describe("existing behaviour still holds", () => {
  it("a normal signed-in user can still use the API", async () => {
    await signUp();
    expect((await call(lists.GET)).status).toBe(200);
  });
});
