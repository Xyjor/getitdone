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
import { taskCreateSchema, taskQuerySchema } from "@/lib/validations";

/**
 * GET /api/tasks?listId=&view=all|today|upcoming|completed&q=&today=YYYY-MM-DD
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const { listId, view, q, today } = taskQuerySchema.parse(params);

  const todayDate = fromDateOnly(today ?? new Date().toISOString().slice(0, 10))!;

  const where: Prisma.TaskWhereInput = { userId: user.id };
  if (listId) where.listId = listId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  let orderBy: Prisma.TaskOrderByWithRelationInput[];
  switch (view) {
    case "today": // due today or overdue
      Object.assign(where, { completed: false, dueDate: { lte: todayDate } });
      orderBy = [{ dueDate: "asc" }, { priority: "desc" }, { position: "asc" }];
      break;
    case "upcoming":
      Object.assign(where, { completed: false, dueDate: { gt: todayDate } });
      orderBy = [{ dueDate: "asc" }, { priority: "desc" }, { position: "asc" }];
      break;
    case "completed":
      where.completed = true;
      orderBy = [{ updatedAt: "desc" }];
      break;
    default:
      orderBy = [{ completed: "asc" }, { position: "asc" }, { createdAt: "asc" }];
  }

  const tasks = await db.task.findMany({ where, orderBy, take: 500 });
  return NextResponse.json({ tasks: tasks.map(toTaskDTO) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { dueDate, notes, ...data } = await parseBody(req, taskCreateSchema);

  const list = await db.list.findFirst({ where: { id: data.listId, userId: user.id } });
  if (!list) throw notFound("List");

  const last = await db.task.aggregate({
    where: { listId: list.id },
    _max: { position: true },
  });

  const task = await db.task.create({
    data: {
      ...data,
      notes: notes || null,
      dueDate: fromDateOnly(dueDate),
      position: (last._max.position ?? -1) + 1,
      userId: user.id,
    },
  });

  return NextResponse.json({ task: toTaskDTO(task) }, { status: 201 });
});
