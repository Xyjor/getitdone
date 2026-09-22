import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { LIMITS, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { loginSchema } from "@/lib/validations";

export const POST = route(async (req) => {
  await rateLimit(`login:ip:${clientIp(req.headers)}`, LIMITS.loginPerIp);
  const { email, password } = await parseBody(req, loginSchema);

  // Count the attempt *before* checking the password: an atomic increment, so a burst of
  // parallel guesses can't all slip in under the limit. A successful login clears the count.
  const emailKey = `login:email:${email}`;
  await rateLimit(emailKey, LIMITS.loginAttemptsPerEmail);

  const user = await db.user.findUnique({ where: { email } });
  // Same message and timing whether the email is unknown or the password is wrong.
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) throw new ApiError(401, "Invalid email or password");

  await resetRateLimit(emailKey);
  await createSession(user.id, req);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, isDemo: user.isDemo },
  });
});
