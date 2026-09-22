import { db } from "@/lib/db";
import { ApiError, forbidden, parseBody, requireUser, route } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validations";

/**
 * POST /api/account/password { currentPassword, newPassword }
 * Changes the password and signs out every *other* device, keeping this one signed in.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.isDemo) throw forbidden("Demo accounts can't change their password");
  await rateLimit(`sensitive:${user.id}`, LIMITS.sensitivePerUser);

  const { currentPassword, newPassword } = await parseBody(req, passwordChangeSchema);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new ApiError(400, "Current password is incorrect", {
      currentPassword: ["Current password is incorrect"],
    });
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    db.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } }),
  ]);
  return new Response(null, { status: 204 });
});
