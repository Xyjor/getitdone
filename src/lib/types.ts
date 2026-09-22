import type { ListColor, PriorityValue } from "./validations";

// JSON shapes returned by the API. Safe to import from client components.

export type UserDTO = { id: string; name: string; email: string; isDemo: boolean };

export type SessionDTO = {
  id: string;
  /** e.g. "Chrome on Windows" */
  device: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
};

export type ListDTO = {
  id: string;
  name: string;
  color: ListColor;
  position: number;
  /** Number of tasks in the list that are not completed yet. */
  openCount: number;
};

export type TaskDTO = {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  /** YYYY-MM-DD, or null when the task has no due date. */
  dueDate: string | null;
  priority: PriorityValue;
  position: number;
  listId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  error: { message: string; fieldErrors?: Record<string, string[]> };
};
