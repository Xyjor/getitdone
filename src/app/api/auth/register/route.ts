import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { registerSchema } from "@/lib/validations";

export const POST = route(async (req) => {
  await rateLimit(`register:ip:${clientIp(req.headers)}`, LIMITS.registerPerIp);
  const { name, email, password } = await parseBody(req, registerSchema);

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists", {
      email: ["An account with this email already exists"],
    });
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      // Every new account starts with one list so the app is usable right away.
      lists: { create: { name: "My Tasks", color: "blue", position: 0 } },
    },
    select: { id: true, name: true, email: true, isDemo: true },
  });

  await createSession(user.id, req);
  return NextResponse.json({ user }, { status: 201 });
});
