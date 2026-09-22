import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { fromDateOnly, parseBody, requireUser, route, toTaskDTO } from "@/lib/api";
import { requireListRole, requireTaskRole } from "@/lib/access";
import { taskUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const { task } = await requireTaskRole(user.id, id, "VIEWER");
  return NextResponse.json({ task: toTaskDTO(task) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { dueDate, notes, listId, ...rest } = await parseBody(req, taskUpdateSchema);

  const { task } = await requireTaskRole(user.id, id, "EDITOR");

  const data: Prisma.TaskUncheckedUpdateInput = { ...rest, dueDate: fromDateOnly(dueDate) };
  if (notes !== undefined) data.notes = notes || null;

  // Moving to another list needs edit rights there too; the task goes to the end.
  if (listId && listId !== task.listId) {
    await requireListRole(user.id, listId, "EDITOR");
    const last = await db.task.aggregate({ where: { listId }, _max: { position: true } });
    data.listId = listId;
    data.position = (last._max.position ?? -1) + 1;
  }

  const updated = await db.task.update({ where: { id: task.id }, data });
  return NextResponse.json({ task: toTaskDTO(updated) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const { task } = await requireTaskRole(user.id, id, "EDITOR");
  await db.task.delete({ where: { id: task.id } });
  return new Response(null, { status: 204 });
});
