import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { requireListRole } from "@/lib/access";
import type { ListInviteDTO, MemberDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/lists/:id/members: the owner and everyone the list is shared with.
 * Only the owner gets email addresses and pending invites; collaborators see names.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { role } = await requireListRole(user.id, id, "VIEWER");

  const list = await db.list.findUniqueOrThrow({
    where: { id },
    select: {
      user: { select: { id: true, name: true, email: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
      },
      invites: role === "OWNER" && {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, role: true, expiresAt: true },
      },
    },
  });

  const isOwner = role === "OWNER";
  const person = (
    u: { id: string; name: string; email: string },
    r: MemberDTO["role"],
  ): MemberDTO => ({
    userId: u.id,
    name: u.name,
    ...(isOwner && { email: u.email }),
    role: r,
  });
  const members: MemberDTO[] = [
    person(list.user, "OWNER"),
    ...list.members.map((m) => person(m.user, m.role)),
  ];
  const invites: ListInviteDTO[] | undefined = list.invites
    ? list.invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }))
    : undefined;

  return NextResponse.json({ members, ...(invites && { invites }) });
});
