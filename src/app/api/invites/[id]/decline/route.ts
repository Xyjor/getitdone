import { db } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { findMyInvite } from "@/lib/invites";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/invites/:id/decline */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const invite = await findMyInvite(id, user.email);
  await db.listInvite.delete({ where: { id: invite.id } });
  return new Response(null, { status: 204 });
});
