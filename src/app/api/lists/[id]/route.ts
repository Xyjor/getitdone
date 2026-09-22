import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUser, route } from "@/lib/api";
import { listSummaryInclude, requireListRole, toListSummary } from "@/lib/access";
import { listUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

// Access rules live in src/lib/access.ts: no access -> 404, too low a role -> 403.

async function summary(listId: string, userId: string) {
  const row = await db.list.findUniqueOrThrow({
    where: { id: listId },
    include: listSummaryInclude(userId),
  });
  return toListSummary(row, userId);
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  await requireListRole(user.id, id, "VIEWER");
  return NextResponse.json({ list: await summary(id, user.id) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const data = await parseBody(req, listUpdateSchema);

  await requireListRole(user.id, id, "OWNER");
  await db.list.update({ where: { id }, data });
  return NextResponse.json({ list: await summary(id, user.id) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  await requireListRole(user.id, id, "OWNER");
  // Tasks, members and invites are removed by ON DELETE CASCADE.
  await db.list.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
