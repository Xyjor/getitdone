"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api-client";
import { loginSchema, registerSchema } from "@/lib/validations";
import { DemoButton } from "./demo-button";

type Mode = "login" | "register";
type Errors = Record<string, string[] | undefined>;

/** Only allow redirects to paths on this site (prevents open-redirect attacks). */
export function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

const FIELDS = {
  login: [
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ],
  register: [
    { name: "name", label: "Name", type: "text", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  ],
} as const;

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const values = Object.fromEntries(new FormData(e.currentTarget));
    const schema: z.ZodType = mode === "login" ? loginSchema : registerSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors as Errors);
      return;
    }
    setErrors({});
    setPending(true);

    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: parsed.data });
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError(err instanceof Error ? err.message : "Something went wrong");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {FIELDS[mode].map((f) => (
            <Field key={f.name} data-invalid={!!errors[f.name]}>
              <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
              <Input
                id={f.name}
                name={f.name}
                type={f.type}
                autoComplete={f.autoComplete}
                aria-invalid={!!errors[f.name]}
                aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
                placeholder={f.name === "email" ? "you@example.com" : undefined}
                disabled={pending}
                required
              />
              <FieldError id={`${f.name}-error`} errors={errors[f.name]?.map((message) => ({ message }))} />
            </Field>
          ))}

          {formError && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </FieldGroup>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <DemoButton variant="outline" className="w-full" />

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
