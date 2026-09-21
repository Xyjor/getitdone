import { describe, expect, it } from "vitest";
import {
  listCreateSchema,
  listUpdateSchema,
  loginSchema,
  registerSchema,
  reorderSchema,
  taskCreateSchema,
  taskQuerySchema,
  taskUpdateSchema,
} from "@/lib/validations";

describe("registerSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const result = registerSchema.parse({ name: "  Ada ", email: " Ada@Example.COM ", password: "password123" });
    expect(result).toEqual({ name: "Ada", email: "ada@example.com", password: "password123" });
  });

  it("rejects short passwords, bad emails and empty names", () => {
    const result = registerSchema.safeParse({ name: " ", email: "nope", password: "short" });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("rejects passwords longer than bcrypt can handle", () => {
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "x".repeat(73) }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("listCreateSchema", () => {
  it("defaults the color", () => {
    expect(listCreateSchema.parse({ name: "Work" })).toEqual({ name: "Work", color: "slate" });
  });

  it("does not add a default color when only renaming", () => {
    expect(listUpdateSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
  });

  it("rejects unknown colors", () => {
    expect(listCreateSchema.safeParse({ name: "Work", color: "chartreuse" }).success).toBe(false);
  });
});

describe("taskCreateSchema", () => {
  it("applies defaults", () => {
    const task = taskCreateSchema.parse({ title: " Buy milk ", listId: "l1" });
    expect(task).toMatchObject({ title: "Buy milk", listId: "l1", priority: "MEDIUM" });
  });

  it("only accepts YYYY-MM-DD due dates", () => {
    expect(taskCreateSchema.safeParse({ title: "x", listId: "l1", dueDate: "2026-09-21" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "x", listId: "l1", dueDate: "21/09/2026" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: "x", listId: "l1", dueDate: "2026-02-30" }).success).toBe(false);
  });
});

describe("taskUpdateSchema", () => {
  it("rejects an empty update", () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("allows clearing the due date", () => {
    expect(taskUpdateSchema.parse({ dueDate: null })).toEqual({ dueDate: null });
  });
});

describe("taskQuerySchema", () => {
  it("defaults to the 'all' view and rejects unknown views", () => {
    expect(taskQuerySchema.parse({}).view).toBe("all");
    expect(taskQuerySchema.safeParse({ view: "someday" }).success).toBe(false);
  });
});

describe("reorderSchema", () => {
  it("requires at least one id", () => {
    expect(reorderSchema.safeParse({ listId: "l1", orderedIds: [] }).success).toBe(false);
  });
});
