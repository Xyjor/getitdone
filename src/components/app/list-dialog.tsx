"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
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
import { useCreateList, useUpdateList } from "@/hooks/use-lists";
import type { ListDTO } from "@/lib/types";
import { LIST_COLOR_CLASSES } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { LIST_COLORS, listCreateSchema, type ListColor } from "@/lib/validations";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When given, the dialog edits this list instead of creating a new one. */
  list?: ListDTO;
};

export function ListDialog({ open, onOpenChange, list }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form each time the dialog opens so it starts from fresh values. */}
        {open && <ListForm list={list} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ListForm({ list, onDone }: { list?: ListDTO; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(list?.name ?? "");
  const [color, setColor] = useState<ListColor>(list?.color ?? "blue");
  const [error, setError] = useState<string>();
  const create = useCreateList();
  const update = useUpdateList();
  const pending = create.isPending || update.isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = listCreateSchema.safeParse({ name, color });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    if (list) {
      update.mutate({ id: list.id, ...parsed.data }, { onSuccess: onDone });
    } else {
      create.mutate(parsed.data, {
        onSuccess: (created) => {
          onDone();
          router.push(`/app/lists/${created.id}`);
        },
      });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{list ? "Edit list" : "New list"}</DialogTitle>
        <DialogDescription>
          {list ? "Rename the list or change its color." : "Group related tasks together."}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="py-6">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="list-name">Name</FieldLabel>
          <Input
            id="list-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            placeholder="e.g. Side projects"
            maxLength={50}
            autoFocus
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </Field>

        <Field>
          <FieldLabel id="list-color-label">Color</FieldLabel>
          <div role="radiogroup" aria-labelledby="list-color-label" className="flex flex-wrap gap-2">
            {LIST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-background transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  LIST_COLOR_CLASSES[c],
                  color === c && "ring-2 ring-foreground/60",
                )}
              >
                {color === c && <Check className="size-4" />}
              </button>
            ))}
          </div>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {list ? "Save changes" : "Create list"}
        </Button>
      </DialogFooter>
    </form>
  );
}
