import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUser, route, toListDTO } from "@/lib/api";
import { requireListRole } from "@/lib/access";
import { listUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

// Access rules live in src/lib/access.ts: no access -> 404, too low a role -> 403.

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const { list } = await requireListRole(user.id, id, "VIEWER");
  const openCount = await db.task.count({ where: { listId: list.id, completed: false } });
  return NextResponse.json({ list: toListDTO(list, openCount) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const data = await parseBody(req, listUpdateSchema);

  await requireListRole(user.id, id, "OWNER");
  const list = await db.list.update({ where: { id }, data });
  return NextResponse.json({ list: toListDTO(list) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  await requireListRole(user.id, id, "OWNER");
  // Tasks, members and invites are removed by ON DELETE CASCADE.
  await db.list.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
