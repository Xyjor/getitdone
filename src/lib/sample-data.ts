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
      { title: "Prepare sprint demo", notes: "Show the new drag-and-drop flow.", due: 0, priority: "HIGH" },
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
      { title: "Build a side project with Next.js", notes: "You're looking at it!", completed: true },
    ],
  },
];

/** Creates a few example lists and tasks for a user (two queries, so it's fast on remote DBs). */
export async function createSampleData(db: Db, userId: string) {
  const lists = await db.list.createManyAndReturn({
    data: SAMPLE_LISTS.map((list, position) => ({ name: list.name, color: list.color, position, userId })),
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
        userId,
      })),
    ),
  });
}
