import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Deliberately does not import "@/lib/db" so the seed script (plain Node) can reuse it.

export const DEMO_EMAIL_DOMAIN = "demo.getitdone.local";

function daysFromToday(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type SampleTask = {
  title: string;
  notes?: string;
  due?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  completed?: boolean;
};

const SAMPLE_LISTS: { name: string; color: string; tasks: SampleTask[] }[] = [
  {
    name: "Work",
    color: "blue",
    tasks: [
      {
        title: "Prepare sprint demo",
        notes: "Show the new drag-and-drop flow.",
        due: 0,
        priority: "HIGH",
      },
      { title: "Review pull requests", due: 0 },
      { title: "Write API documentation", due: 2, priority: "MEDIUM" },
      { title: "1:1 with manager", due: 3, priority: "LOW" },
      { title: "Fix flaky login test", due: -1, priority: "HIGH" },
      { title: "Set up CI pipeline", completed: true },
    ],
  },
  {
    name: "Personal",
    color: "green",
    tasks: [
      { title: "Book dentist appointment", due: 1 },
      { title: "Call mom", due: 0, priority: "HIGH" },
      { title: "Plan weekend hike", notes: "Check the weather first.", due: 4, priority: "LOW" },
      { title: "Renew library card", completed: true },
    ],
  },
  {
    name: "Groceries",
    color: "amber",
    tasks: [
      { title: "Oat milk", priority: "LOW" },
      { title: "Coffee beans", priority: "HIGH" },
      { title: "Spinach" },
      { title: "Eggs", completed: true },
    ],
  },
  {
    name: "Learning",
    color: "violet",
    tasks: [
      { title: "Finish TypeScript generics chapter", due: 5 },
      {
        title: "Build a side project with Next.js",
        notes: "You're looking at it!",
        completed: true,
      },
    ],
  },
];

/** Creates a few example lists and tasks for a user (two queries, so it's fast on remote DBs). */
export async function createSampleData(db: Db, userId: string) {
  const lists = await db.list.createManyAndReturn({
    data: SAMPLE_LISTS.map((list, position) => ({
      name: list.name,
      color: list.color,
      position,
      userId,
    })),
    select: { id: true, position: true },
  });
  const listIdAt = new Map(lists.map((l) => [l.position, l.id]));

  await db.task.createMany({
    data: SAMPLE_LISTS.flatMap((list, listIndex) =>
      list.tasks.map((t, i) => ({
        title: t.title,
        notes: t.notes ?? null,
        priority: t.priority ?? "MEDIUM",
        completed: t.completed ?? false,
        dueDate: t.due === undefined ? null : daysFromToday(t.due),
        position: i,
        listId: listIdAt.get(listIndex)!,
        createdById: userId,
      })),
    ),
  });
}

/**
 * Demo-only: a companion account ("Sam") who has shared a list with the visitor and sent them
 * an invitation, so the sharing features are visible the moment the demo opens.
 */
export async function createSharedSampleData(
  db: Db,
  visitor: { id: string; email: string },
  companion: { email: string; passwordHash: string },
) {
  const sam = await db.user.create({
    data: {
      name: "Sam (demo)",
      email: companion.email,
      passwordHash: companion.passwordHash,
      isDemo: true,
    },
    select: { id: true },
  });

  const [launch, bbq] = await db.list.createManyAndReturn({
    data: [
      { name: "Team launch 🚀", color: "pink", position: 0, userId: sam.id },
      { name: "Weekend BBQ", color: "orange", position: 1, userId: sam.id },
    ],
    select: { id: true },
  });

  await db.listMember.create({ data: { listId: launch!.id, userId: visitor.id, role: "EDITOR" } });
  await db.listInvite.create({
    data: {
      listId: bbq!.id,
      email: visitor.email,
      role: "VIEWER",
      invitedById: sam.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const task = (
    title: string,
    createdById: string,
    i: number,
    extra: Partial<SampleTask> = {},
  ) => ({
    title,
    listId: launch!.id,
    createdById,
    position: i,
    priority: extra.priority ?? "MEDIUM",
    completed: extra.completed ?? false,
    dueDate: extra.due === undefined ? null : daysFromToday(extra.due),
    notes: extra.notes ?? null,
  });

  await db.task.createMany({
    data: [
      task("Finalize launch checklist", sam.id, 0, { due: 0, priority: "HIGH" }),
      task("Record the product demo video", visitor.id, 1, {
        due: 2,
        notes: "Keep it under 2 minutes.",
      }),
      task("Draft the announcement email", sam.id, 2, { due: 1 }),
      task("Book the launch venue", sam.id, 3, { completed: true }),
      { ...task("Burgers and veggie patties", sam.id, 0), listId: bbq!.id },
      { ...task("Borrow a second grill", sam.id, 1, { due: 4 }), listId: bbq!.id },
    ],
  });
}
