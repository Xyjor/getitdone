import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { ListColor, PriorityValue } from "./validations";

// Full class names are spelled out so Tailwind can find them when scanning source files.
export const LIST_COLOR_CLASSES: Record<ListColor, string> = {
  slate: "bg-slate-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

export const PRIORITY_META: Record<PriorityValue, { label: string; className: string }> = {
  HIGH: { label: "High", className: "text-red-600 dark:text-red-400" },
  MEDIUM: { label: "Medium", className: "text-amber-600 dark:text-amber-400" },
  LOW: { label: "Low", className: "text-sky-600 dark:text-sky-400" },
};

/** Human-friendly due date label relative to today, e.g. "Today", "Tomorrow", "Mon, Sep 29". */
export function formatDueDate(dueDate: string, today: string) {
  const diff = differenceInCalendarDays(parseISO(dueDate), parseISO(today));
  if (diff === 0) return { label: "Today", tone: "today" as const };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" as const };
  if (diff === -1) return { label: "Yesterday", tone: "overdue" as const };
  if (diff < 0) return { label: format(parseISO(dueDate), "MMM d"), tone: "overdue" as const };
  if (diff < 7) return { label: format(parseISO(dueDate), "EEEE"), tone: "soon" as const };
  return { label: format(parseISO(dueDate), "MMM d"), tone: "later" as const };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
