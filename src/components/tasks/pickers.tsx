"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localToday } from "@/lib/api-client";
import type { ListDTO } from "@/lib/types";
import { LIST_COLOR_CLASSES, PRIORITY_META, formatDueDate } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { PRIORITIES, type PriorityValue } from "@/lib/validations";

// ---- Due date ----

type DatePickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  size?: "sm" | "default";
  className?: string;
};

export function DueDatePicker({ value, onChange, size = "default", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = localToday();

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={cn("justify-start font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon />
          {value ? formatDueDate(value, today).label : "Due date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-wrap gap-1 border-b p-2">
          <Button type="button" size="xs" variant="secondary" onClick={() => pick(today)}>
            Today
          </Button>
          <Button type="button" size="xs" variant="secondary" onClick={() => pick(localToday(1))}>
            Tomorrow
          </Button>
          <Button type="button" size="xs" variant="secondary" onClick={() => pick(localToday(7))}>
            Next week
          </Button>
          {value && (
            <Button type="button" size="xs" variant="ghost" onClick={() => pick(null)}>
              <X /> Clear
            </Button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          defaultMonth={value ? parseISO(value) : undefined}
          onSelect={(d) => pick(d ? format(d, "yyyy-MM-dd") : null)}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---- Priority ----

export function PrioritySelect({
  value,
  onChange,
  size = "default",
  className,
}: {
  value: PriorityValue;
  onChange: (value: PriorityValue) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PriorityValue)}>
      <SelectTrigger size={size} className={className} aria-label="Priority">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[...PRIORITIES].reverse().map((p) => (
          <SelectItem key={p} value={p}>
            <Flag className={PRIORITY_META[p].className} />
            {PRIORITY_META[p].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---- List ----

export function ListSelect({
  lists,
  value,
  onChange,
  size = "default",
  className,
}: {
  lists: ListDTO[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size={size} className={className} aria-label="List">
        <SelectValue placeholder="Choose a list" />
      </SelectTrigger>
      <SelectContent>
        {lists.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            <span className={cn("size-2.5 rounded-full", LIST_COLOR_CLASSES[l.color])} />
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
