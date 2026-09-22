"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarCheck2,
  ChevronRight,
  Eye,
  PartyPopper,
  SearchX,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ShareDialog } from "@/components/sharing/share-dialog";
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
  const listsById = useMemo(() => new Map((lists.data ?? []).map((l) => [l.id, l])), [lists.data]);
  const list = mode.kind === "list" ? listsById.get(mode.listId) : undefined;
  // Shared lists poll so collaborators' changes appear; so do views that include shared lists.
  const live = mode.kind === "list" ? isShared(list) : (lists.data ?? []).some(isShared);
  const tasks = useTasks(toFilter(mode), { live });
  const [shareOpen, setShareOpen] = useState(false);

  if (mode.kind === "list" && lists.isSuccess && !list) return <ListNotFound />;

  const header = getHeader(mode, list, today);
  const readOnly = list?.role === "VIEWER";
  const editableLists = (lists.data ?? []).filter((l) => l.role !== "VIEWER");
  const canAdd = mode.kind !== "completed" && mode.kind !== "search" && !readOnly;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {list && (
              <span
                className={cn("size-3 shrink-0 rounded-full", LIST_COLOR_CLASSES[list.color])}
              />
            )}
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {header.title ?? <Skeleton className="h-8 w-40" />}
            </h1>
          </div>
          {header.subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{header.subtitle}</p>
          )}
          {list && list.role !== "OWNER" && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-3.5" /> Shared by {list.ownerName} ·{" "}
              {list.role === "EDITOR" ? "you can edit" : "view only"}
            </p>
          )}
        </div>
        {list?.role === "OWNER" && (
          <Button variant="outline" onClick={() => setShareOpen(true)} className="shrink-0">
            <UserPlus /> Share
            {list.memberCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                {list.memberCount}
              </span>
            )}
          </Button>
        )}
      </header>

      {list?.role === "OWNER" && (
        <ShareDialog list={list} open={shareOpen} onOpenChange={setShareOpen} />
      )}

      {readOnly && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Eye className="size-4" /> View only. Ask {list?.ownerName} for edit access to make
          changes.
        </p>
      )}

      {canAdd && lists.data && (
        <div className="mb-6">
          <AddTaskForm
            key={mode.kind === "list" ? mode.listId : mode.kind}
            lists={editableLists}
            listId={mode.kind === "list" ? mode.listId : undefined}
            defaultDueDate={
              mode.kind === "today" ? today : mode.kind === "upcoming" ? localToday(1) : null
            }
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
        <TaskGroups
          mode={mode}
          tasks={tasks.data}
          listsById={listsById}
          today={today}
          readOnly={readOnly}
          showCreator={mode.kind === "list" && isShared(list)}
        />
      )}
    </div>
  );
}

/** A list other people can (or are about to) see: shared by me, invited to, or shared with me. */
function isShared(l?: ListDTO) {
  return !!l && (l.memberCount > 0 || l.pendingInviteCount > 0 || l.role !== "OWNER");
}

function getHeader(mode: TaskViewMode, list: ListDTO | undefined, today: string) {
  switch (mode.kind) {
    case "list":
      return {
        title: list?.name,
        subtitle: list
          ? `${list.openCount} open ${list.openCount === 1 ? "task" : "tasks"}`
          : undefined,
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
  readOnly,
  showCreator,
}: {
  mode: TaskViewMode;
  tasks: TaskDTO[];
  listsById: Map<string, ListDTO>;
  today: string;
  readOnly: boolean;
  showCreator: boolean;
}) {
  if (mode.kind === "list") {
    const open = tasks.filter((t) => !t.completed);
    const done = tasks.filter((t) => t.completed);
    return (
      <div className="space-y-6">
        {open.length > 0 ? (
          readOnly ? (
            <ul className="space-y-2">
              {open.map((t) => (
                <TaskItem key={t.id} task={t} today={today} readOnly showCreator={showCreator} />
              ))}
            </ul>
          ) : (
            <SortableTaskList
              listId={mode.listId}
              tasks={open}
              today={today}
              showCreator={showCreator}
            />
          )
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <PartyPopper className="size-4" /> All done in this list!
          </p>
        )}
        {done.length > 0 && (
          <CompletedSection
            tasks={done}
            today={today}
            readOnly={readOnly}
            showCreator={showCreator}
          />
        )}
      </div>
    );
  }

  const groups: Group[] = [];
  if (mode.kind === "today") {
    const overdue = tasks.filter((t) => t.dueDate! < today);
    const dueToday = tasks.filter((t) => t.dueDate! >= today);
    if (overdue.length)
      groups.push({ key: "overdue", label: "Overdue", tone: "danger", tasks: overdue });
    if (dueToday.length)
      groups.push({ key: "today", label: overdue.length ? "Today" : undefined, tasks: dueToday });
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
              <TaskItem
                key={t.id}
                task={t}
                list={listsById.get(t.listId)}
                showList
                today={today}
                readOnly={listsById.get(t.listId)?.role === "VIEWER"}
                showCreator={isShared(listsById.get(t.listId))}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CompletedSection({
  tasks,
  today,
  readOnly,
  showCreator,
}: {
  tasks: TaskDTO[];
  today: string;
  readOnly: boolean;
  showCreator: boolean;
}) {
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
            <TaskItem
              key={t.id}
              task={t}
              today={today}
              readOnly={readOnly}
              showCreator={showCreator}
            />
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
  today: {
    icon: CalendarCheck2,
    title: "Nothing due today",
    text: "Enjoy the free time, or plan something above.",
  },
  upcoming: {
    icon: CalendarCheck2,
    title: "Nothing scheduled",
    text: "Tasks with a future due date show up here.",
  },
  completed: {
    icon: PartyPopper,
    title: "No completed tasks yet",
    text: "Check off a task and it will appear here.",
  },
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
