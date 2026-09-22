"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLists } from "@/hooks/use-lists";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import type { TaskDTO } from "@/lib/types";
import { PRIORITY_META } from "@/lib/ui";
import { taskUpdateSchema, type PriorityValue } from "@/lib/validations";
import { DueDatePicker, ListSelect, PrioritySelect } from "./pickers";

type Props = {
  task: TaskDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Viewers can read the details but not change them. */
  readOnly?: boolean;
};

export function TaskDialog({ task, open, onOpenChange, readOnly }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open &&
          (readOnly ? (
            <TaskDetails task={task} />
          ) : (
            <TaskForm task={task} onDone={() => onOpenChange(false)} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetails({ task }: { task: TaskDTO }) {
  const { data: lists = [] } = useLists();
  const list = lists.find((l) => l.id === task.listId);
  const rows: [string, string][] = [
    ["Due date", task.dueDate ? format(parseISO(task.dueDate), "EEEE, MMMM d") : "No due date"],
    ["Priority", PRIORITY_META[task.priority].label],
    ["List", list?.name ?? ""],
    ["Added by", task.createdByName ?? "A former member"],
    ["Status", task.completed ? "Completed" : "Open"],
  ];
  return (
    <div>
      <DialogHeader>
        <DialogTitle className="pr-6 break-words">{task.title}</DialogTitle>
        <DialogDescription>View only</DialogDescription>
      </DialogHeader>
      <div className="py-5">
        {task.notes ? (
          <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes.</p>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t pt-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TaskForm({ task, onDone }: { task: TaskDTO; onDone: () => void }) {
  const { data: allLists = [] } = useLists();
  // Tasks can only be moved into lists the user can edit.
  const lists = allLists.filter((l) => l.role !== "VIEWER");
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [priority, setPriority] = useState<PriorityValue>(task.priority);
  const [listId, setListId] = useState(task.listId);
  const [error, setError] = useState<string>();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = taskUpdateSchema.safeParse({ title, notes, dueDate, priority, listId });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    update.mutate({ id: task.id, ...parsed.data });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit task</DialogTitle>
        <DialogDescription className="sr-only">Change the task details and save.</DialogDescription>
      </DialogHeader>

      <FieldGroup className="py-6">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="task-title">Title</FieldLabel>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(undefined);
            }}
            maxLength={200}
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="task-notes">Notes</FieldLabel>
          <Textarea
            id="task-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add details…"
            rows={4}
            maxLength={2000}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>Due date</FieldLabel>
            <DueDatePicker value={dueDate} onChange={setDueDate} className="w-full" />
          </Field>
          <Field>
            <FieldLabel>Priority</FieldLabel>
            <PrioritySelect value={priority} onChange={setPriority} className="w-full" />
          </Field>
          <Field>
            <FieldLabel>List</FieldLabel>
            <ListSelect lists={lists} value={listId} onChange={setListId} className="w-full" />
          </Field>
        </div>
      </FieldGroup>

      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            remove.mutate(task.id);
            onDone();
          }}
        >
          <Trash2 /> Delete
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </DialogFooter>
    </form>
  );
}
