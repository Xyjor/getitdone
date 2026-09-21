import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  fromDateOnly,
  notFound,
  parseBody,
  requireUser,
  route,
  toTaskDTO,
} from "@/lib/api";
import { taskUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const task = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!task) throw notFound("Task");

  return NextResponse.json({ task: toTaskDTO(task) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { dueDate, notes, listId, ...rest } = await parseBody(req, taskUpdateSchema);

  const task = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!task) throw notFound("Task");

  const data: Prisma.TaskUncheckedUpdateInput = { ...rest, dueDate: fromDateOnly(dueDate) };
  if (notes !== undefined) data.notes = notes || null;

  // Moving to another list: make sure the user owns it, and put the task at the end.
  if (listId && listId !== task.listId) {
    const target = await db.list.findFirst({ where: { id: listId, userId: user.id } });
    if (!target) throw notFound("List");
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

  const { count } = await db.task.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw notFound("Task");

  return new Response(null, { status: 204 });
});
