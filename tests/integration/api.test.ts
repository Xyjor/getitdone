import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  call,
  headersMock,
  jar,
  TEST_EMAIL_DOMAIN,
  uniqueEmail,
  switchToSession,
  deleteUsers,
} from "./helpers";

vi.mock("next/headers", () => headersMock);

// Imported after the mock so route handlers pick it up.
const { db } = await import("@/lib/db");
const register = await import("@/app/api/auth/register/route");
const login = await import("@/app/api/auth/login/route");
const logout = await import("@/app/api/auth/logout/route");
const me = await import("@/app/api/auth/me/route");
const demo = await import("@/app/api/auth/demo/route");
const lists = await import("@/app/api/lists/route");
const listById = await import("@/app/api/lists/[id]/route");
const tasks = await import("@/app/api/tasks/route");
const taskById = await import("@/app/api/tasks/[id]/route");
const reorder = await import("@/app/api/tasks/reorder/route");
const { DEMO_EMAIL_DOMAIN } = await import("@/lib/sample-data");

type List = { id: string; name: string; color: string; openCount: number };
type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  listId: string;
};
type ListBody = { list: List };
type TaskBody = { task: Task };
type TasksBody = { tasks: Task[] };
type ErrorBody = { error: { message: string; fieldErrors?: Record<string, string[]> } };

const demoUserIds: string[] = [];

async function signUp(label = "user") {
  jar.clear();
  const email = uniqueEmail(label);
  const res = await call<{ user: { id: string } }>(register.POST, {
    method: "POST",
    body: { name: "Test User", email, password: "password123" },
  });
  expect(res.status).toBe(201);
  return { email, id: res.body.user.id, session: new Map(jar) };
}

const createList = async (name: string) =>
  (await call<ListBody>(lists.POST, { method: "POST", body: { name } })).body.list;

const createTask = async (body: Record<string, unknown>) =>
  call<TaskBody>(tasks.POST, { method: "POST", body });

afterAll(async () => {
  await deleteUsers(db, {
    OR: [{ email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } }, { id: { in: demoUserIds } }],
  });
  await db.$disconnect();
});

beforeEach(() => jar.clear());

describe("auth", () => {
  it("registers, sets a session cookie and creates a starter list", async () => {
    const { id } = await signUp();
    expect(jar.get("getitdone_session")).toBeTruthy();

    const who = await call<{ user: { id: string } }>(me.GET);
    expect(who.status).toBe(200);
    expect(who.body.user.id).toBe(id);

    const res = await call<{ lists: List[] }>(lists.GET);
    expect(res.body.lists).toHaveLength(1);
  });

  it("never returns the password hash", async () => {
    await signUp();
    const who = await call(me.GET);
    expect(JSON.stringify(who.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it("rejects a duplicate email with 409 (case-insensitive)", async () => {
    const { email } = await signUp();
    const res = await call(register.POST, {
      method: "POST",
      body: { name: "Again", email: email.toUpperCase(), password: "password123" },
    });
    expect(res.status).toBe(409);
  });

  it("returns field errors for invalid input", async () => {
    const res = await call<ErrorBody>(register.POST, {
      method: "POST",
      body: { name: "", email: "bad", password: "x" },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["name", "email", "password"]),
    );
  });

  it("rejects malformed JSON", async () => {
    const res = await call(register.POST, { method: "POST", body: "{nope" });
    expect(res.status).toBe(400);
  });

  it("logs in with the right password and uses one generic error otherwise", async () => {
    const { email } = await signUp();
    jar.clear();

    const wrong = await call<ErrorBody>(login.POST, {
      method: "POST",
      body: { email, password: "wrong-password" },
    });
    const unknown = await call<ErrorBody>(login.POST, {
      method: "POST",
      body: { email: uniqueEmail("ghost"), password: "password123" },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(jar.size).toBe(0);

    const ok = await call(login.POST, { method: "POST", body: { email, password: "password123" } });
    expect(ok.status).toBe(200);
    expect(jar.get("getitdone_session")).toBeTruthy();
  });

  it("logs out by clearing the cookie", async () => {
    await signUp();
    const res = await call(logout.POST, { method: "POST" });
    expect(res.status).toBe(204);
    expect(jar.size).toBe(0);
    expect((await call(me.GET)).status).toBe(401);
  });

  it("creates an isolated demo account with sample data", async () => {
    const res = await call<{ user: { id: string; email: string } }>(demo.POST, { method: "POST" });
    expect(res.status).toBe(201);
    demoUserIds.push(res.body.user.id);
    expect(res.body.user.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)).toBe(true);

    const res2 = await call<{ lists: List[] }>(lists.GET);
    expect(res2.body.lists.length).toBeGreaterThan(1);
  });
});

describe("protected routes", () => {
  it("returns 401 without a session", async () => {
    for (const handler of [lists.GET, tasks.GET, me.GET]) {
      expect((await call(handler)).status).toBe(401);
    }
  });

  it("returns 401 for a forged cookie", async () => {
    jar.set("getitdone_session", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad");
    expect((await call(lists.GET)).status).toBe(401);
  });

  it("blocks cross-origin writes", async () => {
    await signUp();
    const res = await call(lists.POST, {
      method: "POST",
      body: { name: "Sneaky" },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });
});

describe("lists and tasks", () => {
  it("supports full CRUD", async () => {
    await signUp();

    const created = await call<ListBody>(lists.POST, {
      method: "POST",
      body: { name: "Work", color: "blue" },
    });
    expect(created.status).toBe(201);
    const listId = created.body.list.id;

    const renamed = await call<ListBody>(listById.PATCH, {
      method: "PATCH",
      params: { id: listId },
      body: { name: "Deep work" },
    });
    expect(renamed.body.list).toMatchObject({ name: "Deep work", color: "blue" });

    const task = await createTask({
      title: "Write tests",
      listId,
      dueDate: "2026-09-21",
      priority: "HIGH",
    });
    expect(task.status).toBe(201);
    expect(task.body.task).toMatchObject({
      title: "Write tests",
      dueDate: "2026-09-21",
      completed: false,
    });
    const taskId = task.body.task.id;

    const done = await call<TaskBody>(taskById.PATCH, {
      method: "PATCH",
      params: { id: taskId },
      body: { completed: true, dueDate: null },
    });
    expect(done.body.task).toMatchObject({ completed: true, dueDate: null });

    expect((await call(taskById.DELETE, { method: "DELETE", params: { id: taskId } })).status).toBe(
      204,
    );
    expect((await call(taskById.GET, { params: { id: taskId } })).status).toBe(404);

    expect((await call(listById.DELETE, { method: "DELETE", params: { id: listId } })).status).toBe(
      204,
    );
    expect((await call(listById.GET, { params: { id: listId } })).status).toBe(404);
  });

  it("deleting a list deletes its tasks", async () => {
    await signUp();
    const list = await createList("Temp");
    const t = await createTask({ title: "Gone soon", listId: list.id });
    await call(listById.DELETE, { method: "DELETE", params: { id: list.id } });
    expect(await db.task.findUnique({ where: { id: t.body.task.id } })).toBeNull();
  });

  it("filters by view and search", async () => {
    await signUp();
    const { id: listId } = await createList("Views");
    const add = (title: string, dueDate: string | null) => createTask({ title, listId, dueDate });

    await add("Overdue thing", "2026-09-19");
    await add("Due today", "2026-09-21");
    await add("Next week", "2026-09-28");
    const doneTask = await add("Already done", "2026-09-21");
    await add("No date", null);
    await call(taskById.PATCH, {
      method: "PATCH",
      params: { id: doneTask.body.task.id },
      body: { completed: true },
    });

    const titles = async (search: Record<string, string>) =>
      (
        await call<TasksBody>(tasks.GET, { search: { ...search, today: "2026-09-21" } })
      ).body.tasks.map((t) => t.title);

    expect(await titles({ view: "today" })).toEqual(["Overdue thing", "Due today"]);
    expect(await titles({ view: "upcoming" })).toEqual(["Next week"]);
    expect(await titles({ view: "completed" })).toEqual(["Already done"]);
    expect(await titles({ listId })).toHaveLength(5);
    expect(await titles({ q: "WEEK" })).toEqual(["Next week"]);
  });

  it("counts open tasks per list", async () => {
    await signUp();
    const list = await createList("Count");
    await createTask({ title: "a", listId: list.id });
    await createTask({ title: "b", listId: list.id });
    const res = await call<{ lists: List[] }>(lists.GET);
    expect(res.body.lists.find((l) => l.id === list.id)?.openCount).toBe(2);
  });

  it("reorders tasks and moves them between lists", async () => {
    await signUp();
    const a = (await createList("A")).id;
    const b = (await createList("B")).id;
    const ids: string[] = [];
    for (const title of ["one", "two", "three"]) {
      ids.push((await createTask({ title, listId: a })).body.task.id);
    }

    const res = await call(reorder.POST, {
      method: "POST",
      body: { listId: a, orderedIds: [ids[2], ids[0], ids[1]] },
    });
    expect(res.status).toBe(204);
    const order = (await call<TasksBody>(tasks.GET, { search: { listId: a } })).body.tasks.map(
      (t) => t.title,
    );
    expect(order).toEqual(["three", "one", "two"]);

    const moved = await call<TaskBody>(taskById.PATCH, {
      method: "PATCH",
      params: { id: ids[0]! },
      body: { listId: b },
    });
    expect(moved.body.task.listId).toBe(b);

    const dup = await call(reorder.POST, {
      method: "POST",
      body: { listId: a, orderedIds: [ids[1], ids[1]] },
    });
    expect(dup.status).toBe(400);
  });
});

describe("data isolation between users", () => {
  it("prevents one user from reading or changing another user's data", async () => {
    const alice = await signUp("alice");
    const aliceList = await createList("Alice only");
    const aliceTask = (await createTask({ title: "Secret", listId: aliceList.id })).body.task;

    await signUp("mallory");
    const params = (id: string) => ({ params: { id } });

    // Reads
    expect((await call(listById.GET, params(aliceList.id))).status).toBe(404);
    expect((await call(taskById.GET, params(aliceTask.id))).status).toBe(404);
    expect(
      (await call<TasksBody>(tasks.GET, { search: { listId: aliceList.id } })).body.tasks,
    ).toEqual([]);
    expect((await call<TasksBody>(tasks.GET, { search: { q: "Secret" } })).body.tasks).toEqual([]);

    // Writes
    const attempts = [
      call(listById.PATCH, { method: "PATCH", ...params(aliceList.id), body: { name: "pwned" } }),
      call(listById.DELETE, { method: "DELETE", ...params(aliceList.id) }),
      call(taskById.PATCH, { method: "PATCH", ...params(aliceTask.id), body: { completed: true } }),
      call(taskById.DELETE, { method: "DELETE", ...params(aliceTask.id) }),
      createTask({ title: "Injected", listId: aliceList.id }),
      call(reorder.POST, {
        method: "POST",
        body: { listId: aliceList.id, orderedIds: [aliceTask.id] },
      }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);

    // Moving your own task into someone else's list is blocked too.
    const myList = (await call<{ lists: List[] }>(lists.GET)).body.lists[0]!;
    const mine = (await createTask({ title: "Mine", listId: myList.id })).body.task;
    const move = await call(taskById.PATCH, {
      method: "PATCH",
      ...params(mine.id),
      body: { listId: aliceList.id },
    });
    expect(move.status).toBe(404);

    // Alice's data is untouched.
    switchToSession(alice.session);
    const check = await call<TaskBody>(taskById.GET, params(aliceTask.id));
    expect(check.body.task).toMatchObject({ title: "Secret", completed: false });
  });
});
