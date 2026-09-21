"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarCheck2,
  ChevronRight,
  PartyPopper,
  SearchX,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLists } from "@/hooks/use-lists";
import { useTasks, type TaskFilter } from "@/hooks/use-tasks";
import { localToday } from "@/lib/api-client";
import type { ListDTO, TaskDTO } from "@/lib/types";
import { LIST_COLOR_CLASSES, formatDueDate } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AddTaskForm } from "./add-task-form";
import { SortableTaskList } from "./sortable-task-list";
import { TaskItem } from "./task-item";

export type TaskViewMode =
  | { kind: "list"; listId: string }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "completed" }
  | { kind: "search"; q: string };

function toFilter(mode: TaskViewMode): TaskFilter {
  switch (mode.kind) {
    case "list":
      return { view: "all", listId: mode.listId };
    case "search":
      return { view: "all", q: mode.q };
    default:
      return { view: mode.kind };
  }
}

export function TaskView({ mode }: { mode: TaskViewMode }) {
  const today = localToday();
  const lists = useLists();
  const tasks = useTasks(toFilter(mode));
  const listsById = useMemo(
    () => new Map((lists.data ?? []).map((l) => [l.id, l])),
    [lists.data],
  );

  const list = mode.kind === "list" ? listsById.get(mode.listId) : undefined;
  if (mode.kind === "list" && lists.isSuccess && !list) return <ListNotFound />;

  const header = getHeader(mode, list, today);
  const canAdd = mode.kind !== "completed" && mode.kind !== "search";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          {list && <span className={cn("size-3 rounded-full", LIST_COLOR_CLASSES[list.color])} />}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {header.title ?? <Skeleton className="h-8 w-40" />}
          </h1>
        </div>
        {header.subtitle && <p className="mt-1 text-sm text-muted-foreground">{header.subtitle}</p>}
      </header>

      {canAdd && lists.data && (
        <div className="mb-6">
          <AddTaskForm
            key={mode.kind === "list" ? mode.listId : mode.kind}
            lists={lists.data}
            listId={mode.kind === "list" ? mode.listId : undefined}
            defaultDueDate={mode.kind === "today" ? today : mode.kind === "upcoming" ? localToday(1) : null}
          />
        </div>
      )}

      {tasks.isPending ? (
        <TaskSkeleton />
      ) : tasks.isError ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load tasks.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => tasks.refetch()}>
            Try again
          </Button>
        </div>
      ) : tasks.data.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <TaskGroups mode={mode} tasks={tasks.data} listsById={listsById} today={today} />
      )}
    </div>
  );
}

function getHeader(mode: TaskViewMode, list: ListDTO | undefined, today: string) {
  switch (mode.kind) {
    case "list":
      return {
        title: list?.name,
        subtitle: list ? `${list.openCount} open ${list.openCount === 1 ? "task" : "tasks"}` : undefined,
      };
    case "today":
      return { title: "Today", subtitle: format(parseISO(today), "EEEE, MMMM d") };
    case "upcoming":
      return { title: "Upcoming", subtitle: "Everything scheduled after today" };
    case "completed":
      return { title: "Completed", subtitle: "Nice work. Here's what you've finished." };
    case "search":
      return { title: "Search", subtitle: `Results for "${mode.q}"` };
  }
}

// ---- Grouping ----

type Group = { key: string; label?: string; tone?: "danger"; tasks: TaskDTO[] };

function TaskGroups({
  mode,
  tasks,
  listsById,
  today,
}: {
  mode: TaskViewMode;
  tasks: TaskDTO[];
  listsById: Map<string, ListDTO>;
  today: string;
}) {
  if (mode.kind === "list") {
    const open = tasks.filter((t) => !t.completed);
    const done = tasks.filter((t) => t.completed);
    return (
      <div className="space-y-6">
        {open.length > 0 ? (
          <SortableTaskList listId={mode.listId} tasks={open} today={today} />
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <PartyPopper className="size-4" /> All done in this list!
          </p>
        )}
        {done.length > 0 && <CompletedSection tasks={done} today={today} />}
      </div>
    );
  }

  const groups: Group[] = [];
  if (mode.kind === "today") {
    const overdue = tasks.filter((t) => t.dueDate! < today);
    const dueToday = tasks.filter((t) => t.dueDate! >= today);
    if (overdue.length) groups.push({ key: "overdue", label: "Overdue", tone: "danger", tasks: overdue });
    if (dueToday.length) groups.push({ key: "today", label: overdue.length ? "Today" : undefined, tasks: dueToday });
  } else if (mode.kind === "upcoming") {
    const byDate = new Map<string, TaskDTO[]>();
    for (const t of tasks) byDate.set(t.dueDate!, [...(byDate.get(t.dueDate!) ?? []), t]);
    for (const [date, items] of byDate) {
      const { label, tone } = formatDueDate(date, today);
      // "Tomorrow · Sep 22", "Friday · Sep 25", or "Mon, Oct 5" further out.
      const heading =
        tone === "soon"
          ? `${label} · ${format(parseISO(date), "MMM d")}`
          : format(parseISO(date), "EEE, MMM d");
      groups.push({ key: date, label: heading, tasks: items });
    }
  } else {
    groups.push({ key: "all", tasks });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          {g.label && (
            <h2
              className={cn(
                "mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                g.tone === "danger" && "text-red-600 dark:text-red-400",
              )}
            >
              {g.label} <span className="font-normal">· {g.tasks.length}</span>
            </h2>
          )}
          <ul className="space-y-2">
            {g.tasks.map((t) => (
              <TaskItem key={t.id} task={t} list={listsById.get(t.listId)} showList today={today} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CompletedSection({ tasks, today }: { tasks: TaskDTO[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-2 flex items-center gap-1 rounded-md text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        Completed <span className="font-normal">· {tasks.length}</span>
      </button>
      {open && (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- States ----

function TaskSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-4" style={{ width: `${60 - i * 8}%` }} />
        </div>
      ))}
    </div>
  );
}

const EMPTY: Record<TaskViewMode["kind"], { icon: LucideIcon; title: string; text: string }> = {
  list: { icon: Sparkles, title: "This list is empty", text: "Add your first task above." },
  today: { icon: CalendarCheck2, title: "Nothing due today", text: "Enjoy the free time, or plan something above." },
  upcoming: { icon: CalendarCheck2, title: "Nothing scheduled", text: "Tasks with a future due date show up here." },
  completed: { icon: PartyPopper, title: "No completed tasks yet", text: "Check off a task and it will appear here." },
  search: { icon: SearchX, title: "No matching tasks", text: "Try a different search term." },
};

function EmptyState({ mode }: { mode: TaskViewMode }) {
  const { icon: Icon, title, text } = EMPTY[mode.kind];
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ListNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <SearchX className="mb-4 size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">List not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        It may have been deleted, or it belongs to someone else.
      </p>
      <Button asChild className="mt-6">
        <Link href="/app/today">Go to Today</Link>
      </Button>
    </div>
  );
}
