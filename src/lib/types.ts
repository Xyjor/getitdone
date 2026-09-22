import type { ListColor, MemberRoleValue, PriorityValue } from "./validations";

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
  /** The current user's role on this list. */
  role: ListRoleValue;
  ownerName: string;
  /** People the list is shared with (not counting the owner). */
  memberCount: number;
};

export type ListRoleValue = "OWNER" | MemberRoleValue;

export type MemberDTO = { userId: string; name: string; email: string; role: ListRoleValue };

/** A pending invite, as seen by the list owner. */
export type ListInviteDTO = { id: string; email: string; role: MemberRoleValue; expiresAt: string };

/** An invite addressed to the current user. */
export type InviteDTO = {
  id: string;
  listId: string;
  listName: string;
  listColor: ListColor;
  role: MemberRoleValue;
  invitedByName: string;
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
  /** Who added the task (null if their account was deleted). */
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  error: { message: string; fieldErrors?: Record<string, string[]> };
};
