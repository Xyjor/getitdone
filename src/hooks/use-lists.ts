"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useUserActive } from "./use-user-active";
import type { ListDTO } from "@/lib/types";
import type { ListCreateInput, ListUpdateInput } from "@/lib/validations";

export const listsKey = ["lists"] as const;

export function useLists() {
  const active = useUserActive();
  return useQuery({
    queryKey: listsKey,
    queryFn: () => api<{ lists: ListDTO[] }>("/api/lists").then((r) => r.lists),
    // Picks up lists shared with you, role changes and removals made by other people.
    // Paused while the user is idle (and while the tab is hidden, TanStack's default).
    refetchInterval: active ? 30_000 : false,
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ListCreateInput) =>
      api<{ list: ListDTO }>("/api/lists", { method: "POST", body: input }).then((r) => r.list),
    onSuccess: (list) => {
      qc.setQueryData<ListDTO[]>(listsKey, (old = []) => [...old, list]);
      toast.success(`List "${list.name}" created`);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ListUpdateInput & { id: string }) =>
      api<{ list: ListDTO }>(`/api/lists/${id}`, { method: "PATCH", body: input }).then(
        (r) => r.list,
      ),
    onSuccess: (list) => {
      qc.setQueryData<ListDTO[]>(listsKey, (old = []) =>
        old.map((l) => (l.id === list.id ? { ...l, name: list.name, color: list.color } : l)),
      );
      toast.success("List updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/lists/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.setQueryData<ListDTO[]>(listsKey, (old = []) => old.filter((l) => l.id !== id));
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("List deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
