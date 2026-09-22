import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { ApiErrorBody, ListDTO, TaskDTO } from "@/lib/types";
import type { ListColor } from "@/lib/validations";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[]>,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const forbidden = (message = "You don't have permission to do that") =>
  new ApiError(403, message);

export const notFound = (what = "Resource") => new ApiError(404, `${what} not found`);

function errorResponse(
  status: number,
  message: string,
  fieldErrors?: Record<string, string[]>,
  headers?: Record<string, string>,
) {
  const body: ApiErrorBody = { error: { message, ...(fieldErrors && { fieldErrors }) } };
  return NextResponse.json(body, { status, headers });
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Rejects cross-site state-changing requests. SameSite=Lax cookies already block most CSRF;
 * this is a second layer that checks the browser-supplied Origin header against our host.
 */
function assertSameOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) don't send Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new ApiError(403, "Cross-origin request blocked");
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler with origin checks and consistent JSON error responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.status, err.message, err.fieldErrors, err.headers);
      }
      if (err instanceof ZodError) {
        const { fieldErrors, formErrors } = z.flattenError(err);
        return errorResponse(
          400,
          formErrors[0] ?? "Invalid input",
          fieldErrors as Record<string, string[]>,
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return errorResponse(404, "Resource not found");
      }
      console.error(err);
      return errorResponse(500, "Something went wrong");
    }
  };
}

/** Returns the signed-in user or throws 401. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Not authenticated");
  return user;
}

/** Parses and validates a JSON body. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  return schema.parse(json);
}

// ---- Serializers: database rows -> API shapes ----

export function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** "2026-09-21" -> Date at UTC midnight (what Postgres DATE columns map to). */
export function fromDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

/** Include this in task queries so toTaskDTO can show who added the task. */
export const taskInclude = { createdBy: { select: { name: true } } } as const;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toTaskDTO(t: TaskRow): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    completed: t.completed,
    dueDate: toDateOnly(t.dueDate),
    priority: t.priority,
    position: t.position,
    listId: t.listId,
    createdByName: t.createdBy?.name ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

type ListRow = Prisma.ListGetPayload<object>;

type ListExtras = Pick<ListDTO, "role" | "ownerName"> &
  Partial<Pick<ListDTO, "openCount" | "memberCount" | "pendingInviteCount">>;

export function toListDTO(l: ListRow, extras: ListExtras): ListDTO {
  return {
    id: l.id,
    name: l.name,
    color: l.color as ListColor,
    position: l.position,
    openCount: extras.openCount ?? 0,
    role: extras.role,
    ownerName: extras.ownerName,
    memberCount: extras.memberCount ?? 0,
    pendingInviteCount: extras.pendingInviteCount ?? 0,
  };
}
