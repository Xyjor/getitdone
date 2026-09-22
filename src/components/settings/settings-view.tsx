"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Laptop, Loader2, LogOut, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChangePassword,
  useDeleteAccount,
  useLogoutAll,
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
  useUpdateName,
} from "@/hooks/use-account";
import { ApiClientError } from "@/lib/api-client";
import type { UserDTO } from "@/lib/types";
import { accountUpdateSchema, passwordChangeSchema } from "@/lib/validations";

type Errors = Record<string, string[] | undefined>;

function errorsFrom(err: unknown): { fields: Errors; form?: string } {
  if (err instanceof ApiClientError && err.fieldErrors) return { fields: err.fieldErrors };
  return { fields: {}, form: err instanceof Error ? err.message : "Something went wrong" };
}

export function SettingsView({ user }: { user: UserDTO }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 md:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </header>
      <ProfileCard user={user} />
      <PasswordCard isDemo={user.isDemo} />
      <SessionsCard />
      <DangerZone isDemo={user.isDemo} />
    </div>
  );
}

function ProfileCard({ user }: { user: UserDTO }) {
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string>();
  const update = useUpdateName();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = accountUpdateSchema.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    update.mutate(parsed.data.name, { onError: (err) => setError(errorsFrom(err).form) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How your name appears in the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field data-invalid={!!error} className="flex-1">
            <FieldLabel htmlFor="settings-name" className="sr-only">
              Name
            </FieldLabel>
            <Input
              id="settings-name"
              aria-label="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              maxLength={60}
              aria-invalid={!!error}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" disabled={update.isPending || name.trim() === user.name}>
            {update.isPending && <Loader2 className="animate-spin" />}
            Save name
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ isDemo }: { isDemo: boolean }) {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const change = useChangePassword();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setFormError(undefined);
    const parsed = passwordChangeSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = [issue.message];
      return setErrors(next);
    }
    setErrors({});
    change.mutate(parsed.data, {
      onSuccess: () => form.reset(),
      onError: (err) => {
        const { fields, form: message } = errorsFrom(err);
        setErrors(fields);
        setFormError(message);
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          {isDemo
            ? "Demo accounts don't have a password you can change. Create a free account to set one."
            : "Changing your password signs you out on every other device."}
        </CardDescription>
      </CardHeader>
      {!isDemo && (
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {(
                [
                  ["currentPassword", "Current password", "current-password"],
                  ["newPassword", "New password", "new-password"],
                ] as const
              ).map(([name, label, autoComplete]) => (
                <Field key={name} data-invalid={!!errors[name]}>
                  <FieldLabel htmlFor={name}>{label}</FieldLabel>
                  <Input
                    id={name}
                    name={name}
                    type="password"
                    autoComplete={autoComplete}
                    aria-invalid={!!errors[name]}
                  />
                  <FieldError errors={errors[name]?.map((message) => ({ message }))} />
                </Field>
              ))}
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <Button type="submit" className="self-start" disabled={change.isPending}>
                {change.isPending && <Loader2 className="animate-spin" />}
                Change password
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

function SessionsCard() {
  const { data: sessions, isPending } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const logoutAll = useLogoutAll();
  const others = sessions?.filter((s) => !s.current) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices signed in to your account. Sign out any you don&apos;t recognize.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {isPending &&
            Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="p-3">
                <Skeleton className="h-9 w-full" />
              </li>
            ))}
          {sessions?.map((s) => {
            const Icon = /iPhone|Android|iPad/.test(s.device) ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.device}
                    {s.current && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed in {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })} · active{" "}
                    {formatDistanceToNow(new Date(s.lastSeenAt), { addSuffix: true })}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke.mutate(s.id)}
                    disabled={revoke.isPending}
                    aria-label={`Sign out ${s.device}`}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            disabled={others.length === 0 || revokeOthers.isPending}
            onClick={() => revokeOthers.mutate(others.map((s) => s.id))}
          >
            Sign out all other devices
          </Button>
          <Button variant="ghost" onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending}>
            <LogOut /> Log out everywhere
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DangerZone({ isDemo }: { isDemo: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const del = useDeleteAccount();

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    del.mutate(isDemo ? undefined : password, {
      onError: (err) => {
        const { fields, form } = errorsFrom(err);
        setError(fields.password?.[0] ?? form);
      },
    });
  }

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Permanently delete your account, lists and tasks. This can&apos;t be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 /> Delete account
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setPassword("");
          setError(undefined);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={confirm} noValidate>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                All your lists and tasks will be permanently deleted.
                {!isDemo && " Enter your password to confirm."}
              </DialogDescription>
            </DialogHeader>
            {!isDemo && (
              <Field data-invalid={!!error} className="py-4">
                <FieldLabel htmlFor="delete-password">Password</FieldLabel>
                <Input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(undefined);
                  }}
                  aria-invalid={!!error}
                  autoFocus
                />
                <FieldError>{error}</FieldError>
              </Field>
            )}
            {isDemo && error && <p className="py-2 text-sm text-destructive">{error}</p>}
            <DialogFooter className={isDemo ? "pt-4" : undefined}>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={del.isPending || (!isDemo && !password)}
              >
                {del.isPending && <Loader2 className="animate-spin" />}
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
