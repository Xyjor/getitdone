import { z } from "zod";

// Shared by the API (server-side validation) and forms (client-side validation).

export const LIST_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;
export type ListColor = (typeof LIST_COLORS)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type PriorityValue = (typeof PRIORITIES)[number];

export const TASK_VIEWS = ["all", "today", "upcoming", "completed"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

// Trim + lowercase first, then validate (so " Ada@Example.com " is accepted as ada@example.com).
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254, "Email is too long"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"), // bcrypt only uses the first 72 bytes
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

const listName = z.string().trim().min(1, "List name is required").max(50, "List name is too long");

export const listCreateSchema = z.object({
  name: listName,
  color: z.enum(LIST_COLORS).default("slate"),
});

// Separate from the create schema on purpose: `.partial()` would keep the color default,
// so renaming a list would silently reset its color.
export const listUpdateSchema = z.object({
  name: listName.optional(),
  color: z.enum(LIST_COLORS).optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  "Nothing to update",
);

/** Calendar date in YYYY-MM-DD form (due dates have no time or timezone). */
const dateOnly = z.iso.date("Use the YYYY-MM-DD date format");

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(200, "Title is too long"),
  notes: z.string().trim().max(2000, "Notes are too long").nullish(),
  dueDate: dateOnly.nullish(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  listId: z.string().min(1, "List is required"),
});

export const taskUpdateSchema = z
  .object({
    title: taskCreateSchema.shape.title,
    notes: taskCreateSchema.shape.notes,
    dueDate: taskCreateSchema.shape.dueDate,
    priority: z.enum(PRIORITIES),
    listId: z.string().min(1),
    completed: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const taskQuerySchema = z.object({
  listId: z.string().min(1).optional(),
  view: z.enum(TASK_VIEWS).default("all"),
  q: z.string().trim().max(100).optional(),
  /** The client's local date, so "today" matches the user's timezone. */
  today: dateOnly.optional(),
});

export const reorderSchema = z.object({
  listId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1).max(1000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ListCreateInput = z.input<typeof listCreateSchema>;
export type ListUpdateInput = z.infer<typeof listUpdateSchema>;
export type TaskCreateInput = z.input<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
