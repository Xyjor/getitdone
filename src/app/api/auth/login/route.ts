import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, route } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations";

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);

  const user = await db.user.findUnique({ where: { email } });
  // Same message and timing whether the email is unknown or the password is wrong.
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) throw new ApiError(401, "Invalid email or password");

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
});
