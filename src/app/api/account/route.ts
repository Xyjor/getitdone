import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, requireUser, route } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, toUserDTO } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { accountDeleteSchema, accountUpdateSchema } from "@/lib/validations";

/** PATCH /api/account { name } */
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const { name } = await parseBody(req, accountUpdateSchema);
  await db.user.update({ where: { id: user.id }, data: { name } });
  return NextResponse.json({ user: toUserDTO({ ...user, name }) });
});

/**
 * DELETE /api/account { password }
 * Permanently deletes the account; lists, tasks and sessions cascade.
 * Demo accounts don't need a password (the visitor never had one).
 */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`sensitive:${user.id}`, LIMITS.sensitivePerUser);
  const { password } = await parseBody(req, accountDeleteSchema);

  if (!user.isDemo) {
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!password || !(await verifyPassword(password, row.passwordHash))) {
      throw new ApiError(400, "Password is incorrect", { password: ["Password is incorrect"] });
    }
  }

  // Owned lists first (their tasks, members and invites cascade), then the account.
  await db.$transaction([
    db.list.deleteMany({ where: { userId: user.id } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  await clearSessionCookie();
  return new Response(null, { status: 204 });
});
