"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { InviteDTO, ListInviteDTO, MemberDTO } from "@/lib/types";
import type { InviteInput, MemberRoleValue } from "@/lib/validations";
import { listsKey } from "./use-lists";

export const membersKey = (listId: string) => ["members", listId] as const;
export const invitesKey = ["invites"] as const;

/** Invites addressed to me. Polled so new invitations appear without a reload. */
export function useMyInvites() {
  return useQuery({
    queryKey: invitesKey,
    queryFn: () => api<{ invites: InviteDTO[] }>("/api/invites").then((r) => r.invites),
    refetchInterval: 30_000,
  });
}

export function useMembers(listId: string, enabled = true) {
  return useQuery({
    queryKey: membersKey(listId),
    queryFn: () =>
      api<{ members: MemberDTO[]; invites?: ListInviteDTO[] }>(`/api/lists/${listId}/members`),
    enabled,
    // Always fresh when the Share dialog opens, and kept fresh while it's open, so accepted
    // invites turn into members without reopening it.
    staleTime: 0,
    refetchInterval: 10_000,
  });
}

function useRefreshSharing(listId?: string) {
  const qc = useQueryClient();
  return () => {
    if (listId) qc.invalidateQueries({ queryKey: membersKey(listId) });
    qc.invalidateQueries({ queryKey: listsKey });
  };
}

export function useSendInvite(listId: string) {
  const refresh = useRefreshSharing(listId);
  return useMutation({
    mutationFn: (input: InviteInput) =>
      api(`/api/lists/${listId}/invites`, { method: "POST", body: input }),
    onSuccess: (_d, input) => {
      refresh();
      toast.success(`Invitation sent to ${input.email}`);
    },
  });
}

export function useRevokeInvite(listId: string) {
  const refresh = useRefreshSharing(listId);
  return useMutation({
    mutationFn: (inviteId: string) =>
      api(`/api/lists/${listId}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      toast.success("Invitation revoked");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useChangeRole(listId: string) {
  const refresh = useRefreshSharing(listId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRoleValue }) =>
      api(`/api/lists/${listId}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => {
      refresh();
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Removes someone from the list, or yourself (leaving). */
export function useRemoveMember(listId: string) {
  const qc = useQueryClient();
  const refresh = useRefreshSharing(listId);
  return useMutation({
    mutationFn: (userId: string) =>
      api(`/api/lists/${listId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useRespondToInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invite, accept }: { invite: InviteDTO; accept: boolean }) =>
      api(`/api/invites/${invite.id}/${accept ? "accept" : "decline"}`, { method: "POST" }),
    onSuccess: (_d, { invite, accept }) => {
      qc.invalidateQueries({ queryKey: invitesKey });
      qc.invalidateQueries({ queryKey: listsKey });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(accept ? `You joined "${invite.listName}"` : "Invitation declined");
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: invitesKey });
      toast.error(err.message);
    },
  });
}
