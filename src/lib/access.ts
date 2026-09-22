import "server-only";
import { db } from "@/lib/db";
import { forbidden, notFound, taskInclude, toListDTO } from "@/lib/api";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Authorization for lists and tasks, in one place.
 *
 *   OWNER  (List.userId)   everything, including sharing and deleting the list
 *   EDITOR (ListMember)    read + add/edit/complete/delete/reorder tasks
 *   VIEWER (ListMember)    read only
 *
 * Someone with no access gets 404 (we don't reveal that the list exists);
 * someone with access but too low a role gets 403.
 */
export type ListRole = "OWNER" | "EDITOR" | "VIEWER";

const RANK: Record<ListRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export const hasRole = (role: ListRole, min: ListRole) => RANK[role] >= RANK[min];

/** Prisma filter for "lists this user can see" (owned or shared with them). */
export const accessibleListsWhere = (userId: string): Prisma.ListWhereInput => ({
  OR: [{ userId }, { members: { some: { userId } } }],
});

/**
 * Include for list queries that need everything the UI shows: the caller's membership (for
 * their role), the owner's name, and counts of members and open tasks.
 */
export const listSummaryInclude = (userId: string) =>
  ({
    user: { select: { name: true } },
    members: { where: { userId }, select: { role: true } },
    _count: {
      select: {
        members: true,
        tasks: { where: { completed: false } },
        invites: { where: { expiresAt: { gt: new Date() } } },
      },
    },
  }) satisfies Prisma.ListInclude;

type ListSummaryRow = Prisma.ListGetPayload<{ include: ReturnType<typeof listSummaryInclude> }>;

export function toListSummary(row: ListSummaryRow, userId: string) {
  const role: ListRole = row.userId === userId ? "OWNER" : (row.members[0]?.role ?? "VIEWER");
  return toListDTO(row, {
    role,
    ownerName: row.user.name,
    openCount: row._count.tasks,
    memberCount: row._count.members,
    // Only the owner needs to know about pending invites.
    pendingInviteCount: role === "OWNER" ? row._count.invites : 0,
  });
}

/** The list plus the user's role on it, or null if they have no access. One query. */
export async function getListAccess(userId: string, listId: string) {
  const list = await db.list.findFirst({
    where: { id: listId, ...accessibleListsWhere(userId) },
    include: { members: { where: { userId }, select: { role: true } } },
  });
  if (!list) return null;

  const { members, ...rest } = list;
  const role: ListRole = list.userId === userId ? "OWNER" : members[0]!.role;
  return { list: rest, role };
}

/** Throws 404 without access, 403 with too low a role. */
export async function requireListRole(userId: string, listId: string, min: ListRole) {
  const access = await getListAccess(userId, listId);
  if (!access) throw notFound("List");
  if (!hasRole(access.role, min)) throw forbidden();
  return access;
}

/** Same as requireListRole, starting from a task id. */
export async function requireTaskRole(userId: string, taskId: string, min: ListRole) {
  const task = await db.task.findFirst({
    where: { id: taskId, list: accessibleListsWhere(userId) },
    include: {
      ...taskInclude,
      list: { select: { userId: true, members: { where: { userId }, select: { role: true } } } },
    },
  });
  if (!task) throw notFound("Task");

  const { list, ...rest } = task;
  const role: ListRole = list.userId === userId ? "OWNER" : list.members[0]!.role;
  if (!hasRole(role, min)) throw forbidden();
  return { task: rest, role };
}
