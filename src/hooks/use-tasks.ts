"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, localToday } from "@/lib/api-client";
import type { TaskDTO } from "@/lib/types";
import type { TaskCreateInput, TaskUpdateInput, TaskView } from "@/lib/validations";
import { listsKey } from "./use-lists";
import { useUserActive } from "./use-user-active";

export type TaskFilter = { listId?: string; view: TaskView; q?: string };

export const tasksKey = (filter: TaskFilter) => ["tasks", filter] as const;

/** All task mutations share this key, so polling can wait while any of them is in flight. */
const taskMutationKey = ["tasks"] as const;

/**
 * @param live poll for collaborators' changes: every 10s on a shared list, every 30s in views
 * that merely include shared lists. Polling (rather than websockets) keeps hosting free. It
 * pauses while the tab is hidden, while the user is idle, and while a change is still saving
 * (so a refetch can't briefly undo an optimistic update).
 */
export function useTasks(filter: TaskFilter, { live = false }: { live?: boolean } = {}) {
  const qc = useQueryClient();
  const active = useUserActive();
  const interval = filter.listId ? 10_000 : 30_000;
  return useQuery({
    queryKey: tasksKey(filter),
    refetchInterval: () =>
      live && active && qc.isMutating({ mutationKey: taskMutationKey }) === 0 ? interval : false,
    refetchIntervalInBackground: false,
    queryFn: () => {
      const params = new URLSearchParams({ view: filter.view, today: localToday() });
      if (filter.listId) params.set("listId", filter.listId);
      if (filter.q) params.set("q", filter.q);
      return api<{ tasks: TaskDTO[] }>(`/api/tasks?${params}`).then((r) => r.tasks);
    },
  });
}

// ---- Optimistic update helpers ----
// We change every cached task list immediately, then roll back if the server says no.

type Snapshot = [readonly unknown[], TaskDTO[] | undefined][];

async function snapshot(qc: QueryClient): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: ["tasks"] });
  return qc.getQueriesData<TaskDTO[]>({ queryKey: ["tasks"] });
}

function rollback(qc: QueryClient, snap: Snapshot | undefined) {
  snap?.forEach(([key, data]) => qc.setQueryData(key, data));
}

function refresh(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: listsKey });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    mutationFn: (input: TaskCreateInput) =>
      api<{ task: TaskDTO }>("/api/tasks", { method: "POST", body: input }).then((r) => r.task),
    onMutate: async (input) => {
      const snap = await snapshot(qc);
      const now = new Date().toISOString();
      const temp: TaskDTO = {
        id: `temp-${crypto.randomUUID()}`,
        title: input.title,
        notes: input.notes ?? null,
        completed: false,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? "MEDIUM",
        position: Number.MAX_SAFE_INTEGER,
        listId: input.listId,
        createdByName: null,
        createdAt: now,
        updatedAt: now,
      };
      // Show the new task right away in the list it was added to.
      qc.setQueriesData<TaskDTO[]>(
        { queryKey: ["tasks"], predicate: (q) => matchesList(q.queryKey, input.listId) },
        (old) =>
          old ? [...old.filter((t) => !t.completed), temp, ...old.filter((t) => t.completed)] : old,
      );
      return { snap };
    },
    onError: (err, _input, ctx) => {
      rollback(qc, ctx?.snap);
      toast.error(err.message);
    },
    onSettled: () => refresh(qc),
  });
}

function matchesList(key: readonly unknown[], listId: string) {
  const filter = key[1] as TaskFilter | undefined;
  return filter?.view === "all" && filter.listId === listId && !filter.q;
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    mutationFn: ({ id, ...input }: TaskUpdateInput & { id: string }) =>
      api<{ task: TaskDTO }>(`/api/tasks/${id}`, { method: "PATCH", body: input }).then(
        (r) => r.task,
      ),
    onMutate: async ({ id, ...input }) => {
      const snap = await snapshot(qc);
      qc.setQueriesData<TaskDTO[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...input } : t)),
      );
      return { snap };
    },
    onError: (err, _input, ctx) => {
      rollback(qc, ctx?.snap);
      toast.error(err.message);
    },
    onSettled: () => refresh(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: taskMutationKey,
    mutationFn: (id: string) => api(`/api/tasks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      const snap = await snapshot(qc);
      qc.setQueriesData<TaskDTO[]>({ queryKey: ["tasks"] }, (old) =>
        old?.filter((t) => t.id !== id),
      );
      return { snap };
    },
    onSuccess: () => toast.success("Task deleted"),
    onError: (err, _id, ctx) => {
      rollback(qc, ctx?.snap);
      toast.error(err.message);
    },
    onSettled: () => refresh(qc),
  });
}

export function useReorderTasks(listId: string) {
  const qc = useQueryClient();
  const key = tasksKey({ listId, view: "all" });
  return useMutation({
    mutationKey: taskMutationKey,
    mutationFn: (orderedIds: string[]) =>
      api("/api/tasks/reorder", { method: "POST", body: { listId, orderedIds } }),
    onMutate: async (orderedIds) => {
      const snap = await snapshot(qc);
      qc.setQueryData<TaskDTO[]>(key, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((t) => [t.id, t]));
        const reordered = orderedIds.map((id, position) => ({ ...byId.get(id)!, position }));
        const rest = old.filter((t) => !orderedIds.includes(t.id));
        return [...reordered, ...rest];
      });
      return { snap };
    },
    onError: (err, _ids, ctx) => {
      rollback(qc, ctx?.snap);
      toast.error("Couldn't save the new order");
    },
    onSettled: () => refresh(qc),
  });
}
