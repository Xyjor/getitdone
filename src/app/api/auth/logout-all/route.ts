import { db } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/session";

/** Ends every session of the current user, on every device. */
export const POST = route(async () => {
  const user = await requireUser();
  await db.session.deleteMany({ where: { userId: user.id } });
  await clearSessionCookie();
  return new Response(null, { status: 204 });
});
