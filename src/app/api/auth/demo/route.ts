import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { DEMO_EMAIL_DOMAIN, createSampleData, createSharedSampleData } from "@/lib/sample-data";

/**
 * Creates a throwaway account pre-filled with sample data and signs the visitor in.
 * Each visitor gets their own sandbox, so demo users never see each other's changes.
 * Old demo accounts are removed by the daily cleanup cron (/api/cron/cleanup).
 */
export const POST = route(async (req) => {
  await rateLimit(`demo:ip:${clientIp(req.headers)}`, LIMITS.demoPerIp);

  const id = randomBytes(6).toString("hex");
  // Random password nobody knows: demo accounts are only reachable via this endpoint.
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
  const user = await db.$transaction(
    async (tx) => {
      const created = await tx.user.create({
        data: {
          name: "Demo User",
          email: `demo-${id}@${DEMO_EMAIL_DOMAIN}`,
          passwordHash,
          isDemo: true,
        },
        select: { id: true, name: true, email: true, isDemo: true },
      });
      await createSampleData(tx, created.id);
      await createSharedSampleData(tx, created, {
        email: `sam-${id}@${DEMO_EMAIL_DOMAIN}`,
        passwordHash,
      });
      return created;
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  await createSession(user.id, req);
  return NextResponse.json({ user }, { status: 201 });
});
