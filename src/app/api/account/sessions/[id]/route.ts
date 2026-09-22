import { db } from "@/lib/db";
import { notFound, requireUser, route } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/account/sessions/:id: sign out one device. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  // Scoped to the current user, so someone else's session id is simply "not found".
  const { count } = await db.session.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw notFound("Session");

  if (id === user.sessionId) await clearSessionCookie();
  return new Response(null, { status: 204 });
});
