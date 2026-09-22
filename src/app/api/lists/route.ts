import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, requireUser, route, toListDTO } from "@/lib/api";
import { accessibleListsWhere, listSummaryInclude, toListSummary } from "@/lib/access";
import { listCreateSchema } from "@/lib/validations";

export const GET = route(async () => {
  const user = await requireUser();

  const lists = await db.list.findMany({
    where: accessibleListsWhere(user.id),
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: listSummaryInclude(user.id),
  });

  return NextResponse.json({ lists: lists.map((l) => toListSummary(l, user.id)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await parseBody(req, listCreateSchema);

  const last = await db.list.aggregate({ where: { userId: user.id }, _max: { position: true } });
  const list = await db.list.create({
    data: { ...data, userId: user.id, position: (last._max.position ?? -1) + 1 },
  });

  return NextResponse.json(
    { list: toListDTO(list, { role: "OWNER", ownerName: user.name }) },
    { status: 201 },
  );
});
