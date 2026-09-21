import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { DEMO_EMAIL_DOMAIN, createSampleData } from "@/lib/sample-data";

const DEMO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a throwaway account pre-filled with sample data and signs the visitor in.
 * Each visitor gets their own sandbox, so demo users never see each other's changes.
 */
export const POST = route(async () => {
  // Housekeeping: remove demo accounts older than a day (lists/tasks cascade).
  await db.user.deleteMany({
    where: {
      email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
      createdAt: { lt: new Date(Date.now() - DEMO_MAX_AGE_MS) },
    },
  });

  const id = randomBytes(6).toString("hex");
  // Random password nobody knows: demo accounts are only reachable via this endpoint.
  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: "Demo User",
        email: `demo-${id}@${DEMO_EMAIL_DOMAIN}`,
        passwordHash,
      },
      select: { id: true, name: true, email: true },
    });
    await createSampleData(tx, created.id);
    return created;
  });

  await createSession(user.id);
  return NextResponse.json({ user }, { status: 201 });
});
