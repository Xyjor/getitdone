import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { findMyInvite } from "@/lib/invites";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/invites/:id/accept: join the list with the invited role. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const invite = await findMyInvite(id, user.email);

  await db.$transaction([
    db.listMember.upsert({
      where: { listId_userId: { listId: invite.listId, userId: user.id } },
      create: { listId: invite.listId, userId: user.id, role: invite.role },
      update: { role: invite.role },
    }),
    db.listInvite.delete({ where: { id: invite.id } }),
  ]);

  return NextResponse.json({ listId: invite.listId });
});
