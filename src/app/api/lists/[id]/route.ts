import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notFound, parseBody, requireUser, route, toListDTO } from "@/lib/api";
import { listUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

// Lookups always filter by userId as well as id, so another user's list is simply "not found".

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const list = await db.list.findFirst({
    where: { id, userId: user.id },
    include: { _count: { select: { tasks: { where: { completed: false } } } } },
  });
  if (!list) throw notFound("List");

  return NextResponse.json({ list: toListDTO(list, list._count.tasks) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const data = await parseBody(req, listUpdateSchema);

  const { count } = await db.list.updateMany({ where: { id, userId: user.id }, data });
  if (count === 0) throw notFound("List");

  const list = await db.list.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ list: toListDTO(list) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  // Tasks in the list are removed by the ON DELETE CASCADE foreign key.
  const { count } = await db.list.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw notFound("List");

  return new Response(null, { status: 204 });
});
