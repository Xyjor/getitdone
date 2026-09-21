"use client";

import { forwardRef, useState } from "react";
import { CalendarIcon, Flag, GripVertical, MoreHorizontal, Pencil, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import type { ListDTO, TaskDTO } from "@/lib/types";
import { LIST_COLOR_CLASSES, PRIORITY_META, formatDueDate } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { TaskDialog } from "./task-dialog";

const DUE_TONE_CLASSES = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-primary",
  soon: "text-amber-600 dark:text-amber-400",
  later: "text-muted-foreground",
};

type Props = {
  task: TaskDTO;
  list?: ListDTO;
  showList?: boolean;
  today: string;
  /** Props for the drag handle when the row is sortable. */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  style?: React.CSSProperties;
};

export const TaskItem = forwardRef<HTMLLIElement, Props>(function TaskItem(
  { task, list, showList, today, dragHandleProps, isDragging, style },
  ref,
) {
  const [editOpen, setEditOpen] = useState(false);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const saving = task.id.startsWith("temp-");
  const due = task.dueDate ? formatDueDate(task.dueDate, today) : null;

  return (
    <li
      ref={ref}
      style={style}
      className={cn(
        "group/task relative flex items-start gap-2 rounded-xl border bg-card px-2 py-2.5 transition-[box-shadow,opacity] sm:px-3",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/30",
        saving && "opacity-60",
      )}
    >
      {dragHandleProps && (
        <button
          type="button"
          aria-label={`Reorder "${task.title}"`}
          className="mt-0.5 -ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
      )}

      <Checkbox
        checked={task.completed}
        disabled={saving}
        onCheckedChange={(checked) => update.mutate({ id: task.id, completed: checked === true })}
        aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="mt-0.5 size-5 rounded-full"
      />

      <button
        type="button"
        onClick={() => setEditOpen(true)}
        disabled={saving}
        className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "block text-sm leading-5 break-words transition-colors",
            task.completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>

        {(due || task.priority !== "MEDIUM" || task.notes || (showList && list)) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {due && (
              <span className={cn("inline-flex items-center gap-1", !task.completed && DUE_TONE_CLASSES[due.tone])}>
                <CalendarIcon className="size-3" />
                {due.label}
              </span>
            )}
            {task.priority !== "MEDIUM" && (
              <span className={cn("inline-flex items-center gap-1", PRIORITY_META[task.priority].className)}>
                <Flag className="size-3" />
                {PRIORITY_META[task.priority].label}
              </span>
            )}
            {task.notes && (
              <span className="inline-flex items-center gap-1">
                <StickyNote className="size-3" />
                <span className="sr-only">Has notes</span>
              </span>
            )}
            {showList && list && (
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", LIST_COLOR_CLASSES[list.color])} />
                {list.name}
              </span>
            )}
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={saving}
            className="opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
            aria-label={`Options for "${task.title}"`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(task.id)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />
    </li>
  );
});
