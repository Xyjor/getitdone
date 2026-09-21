"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateTask } from "@/hooks/use-tasks";
import type { ListDTO } from "@/lib/types";
import type { PriorityValue } from "@/lib/validations";
import { DueDatePicker, ListSelect, PrioritySelect } from "./pickers";

type Props = {
  lists: ListDTO[];
  /** Fixed list (list page). Otherwise the user picks one. */
  listId?: string;
  defaultDueDate?: string | null;
};

export function AddTaskForm({ lists, listId, defaultDueDate = null }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(defaultDueDate);
  const [priority, setPriority] = useState<PriorityValue>("MEDIUM");
  const [pickedList, setPickedList] = useState<string>();
  const create = useCreateTask();

  const targetList = listId ?? pickedList ?? lists[0]?.id;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !targetList) return;
    create.mutate({ title: trimmed, listId: targetList, dueDate, priority });
    // Reset right away (the task already shows up optimistically) so the next one can be typed.
    setTitle("");
    setDueDate(defaultDueDate);
    setPriority("MEDIUM");
    inputRef.current?.focus();
  }

  if (!targetList) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Create a list in the sidebar to start adding tasks.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
    >
      <div className="flex items-center gap-2 px-3 pt-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label="New task title"
          maxLength={200}
          className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-2">
        <DueDatePicker value={dueDate} onChange={setDueDate} size="sm" />
        <PrioritySelect value={priority} onChange={setPriority} size="sm" className="w-auto min-w-28" />
        {!listId && (
          <ListSelect
            lists={lists}
            value={targetList}
            onChange={setPickedList}
            size="sm"
            className="w-auto min-w-32"
          />
        )}
        <Button type="submit" size="sm" className="ml-auto" disabled={!title.trim()}>
          Add task
        </Button>
      </div>
    </form>
  );
}
