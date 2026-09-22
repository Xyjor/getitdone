import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, forbidden, notFound, parseBody, requireUser, route } from "@/lib/api";
import { requireListRole } from "@/lib/access";
import { memberRoleSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string; userId: string }> };

/** PATCH /api/lists/:id/members/:userId { role }: the owner changes someone's role. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id, userId } = await params;
  const { role } = await parseBody(req, memberRoleSchema);
  await requireListRole(user.id, id, "OWNER");

  const { count } = await db.listMember.updateMany({ where: { listId: id, userId }, data: { role } });
  if (count === 0) throw notFound("Member");
  return NextResponse.json({ member: { userId, role } });
});

/**
 * DELETE /api/lists/:id/members/:userId
 * The owner removes someone, or a member removes themselves (leaves the list).
 */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id, userId } = await params;
  const { list } = await requireListRole(user.id, id, "VIEWER");

  if (userId === list.userId) throw new ApiError(400, "The owner can't leave their own list");
  if (userId !== user.id && list.userId !== user.id) throw forbidden();

  const { count } = await db.listMember.deleteMany({ where: { listId: id, userId } });
  if (count === 0) throw notFound("Member");
  return new Response(null, { status: 204 });
});
