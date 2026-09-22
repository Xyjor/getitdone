import { db } from "@/lib/db";
import { notFound, requireUser, route } from "@/lib/api";
import { requireListRole } from "@/lib/access";

type Ctx = { params: Promise<{ id: string; inviteId: string }> };

/** DELETE /api/lists/:id/invites/:inviteId: the owner revokes a pending invite. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id, inviteId } = await params;
  await requireListRole(user.id, id, "OWNER");

  const { count } = await db.listInvite.deleteMany({ where: { id: inviteId, listId: id } });
  if (count === 0) throw notFound("Invite");
  return new Response(null, { status: 204 });
});
