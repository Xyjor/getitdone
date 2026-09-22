"use client";

import { useState } from "react";
import { Clock, Loader2, Mail, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  useChangeRole,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useSendInvite,
} from "@/hooks/use-sharing";
import { ApiClientError } from "@/lib/api-client";
import type { ListDTO } from "@/lib/types";
import { initials } from "@/lib/ui";
import { inviteSchema, type MemberRoleValue } from "@/lib/validations";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  EDITOR: "Can edit",
  VIEWER: "Can view",
};

type Props = { list: ListDTO; open: boolean; onOpenChange: (open: boolean) => void };

export function ShareDialog({ list, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{list.name}&rdquo;</DialogTitle>
          <DialogDescription>
            Invite people who have a GetItDone account. They&apos;ll see the invitation next time
            they open the app.
          </DialogDescription>
        </DialogHeader>
        {open && <ShareContent listId={list.id} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareContent({ listId }: { listId: string }) {
  const { data, isPending } = useMembers(listId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRoleValue>("EDITOR");
  const [error, setError] = useState<string>();
  const send = useSendInvite(listId);
  const changeRole = useChangeRole(listId);
  const remove = useRemoveMember(listId);
  const revoke = useRevokeInvite(listId);
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);

  function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    send.mutate(parsed.data, {
      onSuccess: () => setEmail(""),
      onError: (err) =>
        setError(
          err instanceof ApiClientError
            ? (err.fieldErrors?.email?.[0] ?? err.message)
            : "Something went wrong",
        ),
    });
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={onInvite}
        noValidate
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
      >
        <Field data-invalid={!!error} className="flex-1">
          <Input
            type="email"
            aria-label="Email to invite"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(undefined);
            }}
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Select value={role} onValueChange={(v) => setRole(v as MemberRoleValue)}>
          <SelectTrigger className="w-full sm:w-32" aria-label="Role for the invite">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EDITOR">Can edit</SelectItem>
            <SelectItem value="VIEWER">Can view</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={send.isPending || !email.trim()}>
          {send.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
          Invite
        </Button>
      </form>

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          People with access
        </h3>
        <ul className="divide-y rounded-lg border">
          {isPending && (
            <li className="p-3">
              <Skeleton className="h-8 w-full" />
            </li>
          )}
          {data?.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 p-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {m.role === "OWNER" ? (
                <span className="text-xs text-muted-foreground">Owner</span>
              ) : (
                <div className="flex items-center gap-1">
                  <Select
                    value={m.role}
                    disabled={changeRole.isPending}
                    onValueChange={(v) =>
                      changeRole.mutate({ userId: m.userId, role: v as MemberRoleValue })
                    }
                  >
                    <SelectTrigger size="sm" className="w-28" aria-label={`Role for ${m.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EDITOR">Can edit</SelectItem>
                      <SelectItem value="VIEWER">Can view</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${m.name}`}
                    disabled={remove.isPending}
                    onClick={() => setRemoving({ userId: m.userId, name: m.name })}
                  >
                    <X />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {data?.invites?.map((i) => (
            <li key={i.id} className="flex items-center gap-3 p-3">
              <div className="grid size-8 place-items-center rounded-full border border-dashed text-muted-foreground">
                <Clock className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{i.email}</p>
                <p className="text-xs text-muted-foreground">Invited · {ROLE_LABEL[i.role]}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(i.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="They'll lose access to this list right away. You can invite them again later."
        confirmLabel="Remove"
        onConfirm={() => removing && remove.mutate(removing.userId)}
      />
    </div>
  );
}
