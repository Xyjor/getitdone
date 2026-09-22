"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { SessionDTO, UserDTO } from "@/lib/types";
import type { PasswordChangeInput } from "@/lib/validations";

export const sessionsKey = ["sessions"] as const;

export function useSessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: () => api<{ sessions: SessionDTO[] }>("/api/account/sessions").then((r) => r.sessions),
  });
}

export function useUpdateName() {
  const router = useRouter();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ user: UserDTO }>("/api/account", { method: "PATCH", body: { name } }).then((r) => r.user),
    onSuccess: () => {
      router.refresh(); // the sidebar gets the user from the server layout
      toast.success("Name updated");
    },
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PasswordChangeInput) =>
      api("/api/account/password", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsKey });
      toast.success("Password changed. Your other devices were signed out.");
    },
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/account/sessions/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      qc.setQueryData<SessionDTO[]>(sessionsKey, (old) => old?.filter((s) => s.id !== id));
      toast.success("Device signed out");
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Signs out every *other* device by revoking each non-current session. */
export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api(`/api/account/sessions/${id}`, { method: "DELETE" })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsKey });
      toast.success("Signed out of all other devices");
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Logs out everywhere, including this device, then leaves the app. */
export function useLogoutAll() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api("/api/auth/logout-all", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (password?: string) =>
      api("/api/account", { method: "DELETE", body: password ? { password } : {} }),
    onSuccess: () => {
      qc.clear();
      toast.success("Your account was deleted");
      router.replace("/");
      router.refresh();
    },
  });
}
