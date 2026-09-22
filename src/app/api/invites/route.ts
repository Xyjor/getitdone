import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import type { InviteDTO } from "@/lib/types";
import type { ListColor } from "@/lib/validations";

/** GET /api/invites: pending, unexpired invites addressed to the current user's email. */
export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db.listInvite.findMany({
    where: { email: user.email, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      list: { select: { id: true, name: true, color: true } },
      invitedBy: { select: { name: true } },
    },
  });

  const invites: InviteDTO[] = rows.map((r) => ({
    id: r.id,
    listId: r.list.id,
    listName: r.list.name,
    listColor: r.list.color as ListColor,
    role: r.role,
    invitedByName: r.invitedBy.name,
  }));
  return NextResponse.json({ invites });
});
