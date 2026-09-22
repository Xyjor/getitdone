import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUser, route, toListDTO } from "@/lib/api";
import { accessibleListsWhere } from "@/lib/access";
import { listCreateSchema } from "@/lib/validations";

export const GET = route(async () => {
  const user = await requireUser();

  const lists = await db.list.findMany({
    where: accessibleListsWhere(user.id),
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { tasks: { where: { completed: false } } } } },
  });

  return NextResponse.json({ lists: lists.map((l) => toListDTO(l, l._count.tasks)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await parseBody(req, listCreateSchema);

  const last = await db.list.aggregate({ where: { userId: user.id }, _max: { position: true } });
  const list = await db.list.create({
    data: { ...data, userId: user.id, position: (last._max.position ?? -1) + 1 },
  });

  return NextResponse.json({ list: toListDTO(list) }, { status: 201 });
});
