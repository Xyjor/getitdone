import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { call, headersMock, jar, saveSession, TEST_EMAIL_DOMAIN, uniqueEmail, switchToSession } from "./helpers";

vi.mock("next/headers", () => headersMock);

const { db } = await import("@/lib/db");
const register = await import("@/app/api/auth/register/route");
const account = await import("@/app/api/account/route");
const lists = await import("@/app/api/lists/route");
const listById = await import("@/app/api/lists/[id]/route");
const tasks = await import("@/app/api/tasks/route");
const taskById = await import("@/app/api/tasks/[id]/route");
const reorder = await import("@/app/api/tasks/reorder/route");
const members = await import("@/app/api/lists/[id]/members/route");
const memberById = await import("@/app/api/lists/[id]/members/[userId]/route");
const listInvites = await import("@/app/api/lists/[id]/invites/route");
const listInviteById = await import("@/app/api/lists/[id]/invites/[inviteId]/route");
const myInvites = await import("@/app/api/invites/route");
const acceptInvite = await import("@/app/api/invites/[id]/accept/route");
const declineInvite = await import("@/app/api/invites/[id]/decline/route");

type User = { id: string; email: string; name: string; session: Map<string, string> };
type List = { id: string; name: string; role: string; ownerName: string; memberCount: number };
type Task = { id: string; title: string; listId: string; createdByName: string | null };
type Invite = { id: string; listId: string; listName: string; role: string; invitedByName: string };

const PASSWORD = "password123";

async function newUser(name: string, email = uniqueEmail(name.toLowerCase())): Promise<User> {
  jar.clear();
  const res = await call<{ user: { id: string } }>(register.POST, {
    method: "POST",
    body: { name, email, password: PASSWORD },
  });
  expect(res.status).toBe(201);
  return { id: res.body.user.id, email, name, session: saveSession() };
}

const as = (u: User) => switchToSession(u.session);

async function createList(owner: User, name: string) {
  as(owner);
  const res = await call<{ list: List }>(lists.POST, { method: "POST", body: { name } });
  expect(res.status).toBe(201);
  return res.body.list;
}

async function createTask(u: User, listId: string, title: string, extra: Record<string, unknown> = {}) {
  as(u);
  const res = await call<{ task: Task }>(tasks.POST, { method: "POST", body: { title, listId, ...extra } });
  return res;
}

async function invite(owner: User, listId: string, email: string, role: "EDITOR" | "VIEWER") {
  as(owner);
  return call<{ message: string }>(listInvites.POST, {
    method: "POST",
    params: { id: listId },
    body: { email, role },
  });
}

async function pendingInvites(u: User) {
  as(u);
  return (await call<{ invites: Invite[] }>(myInvites.GET)).body.invites;
}

/** Invite `u` to the list with `role` and accept it as `u`. */
async function share(owner: User, listId: string, u: User, role: "EDITOR" | "VIEWER") {
  expect((await invite(owner, listId, u.email, role)).status).toBe(201);
  const inv = (await pendingInvites(u)).find((i) => i.listId === listId)!;
  expect((await call(acceptInvite.POST, { method: "POST", params: { id: inv.id } })).status).toBe(200);
}

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } });
  await db.$disconnect();
});

// ---------------------------------------------------------------------------------------------
// The permission matrix: every action for every role, against a hand-written expectation table.
// ---------------------------------------------------------------------------------------------

describe("permission matrix", () => {
  const who: Record<"owner" | "editor" | "viewer" | "outsider", User> = {} as never;
  let listId = "";
  let taskId = "";

  beforeAll(async () => {
    who.owner = await newUser("Olivia");
    who.editor = await newUser("Eddie");
    who.viewer = await newUser("Vera");
    who.outsider = await newUser("Oscar");
    listId = (await createList(who.owner, "Team launch")).id;
    taskId = (await createTask(who.owner, listId, "Write launch post")).body.task.id;
    await share(who.owner, listId, who.editor, "EDITOR");
    await share(who.owner, listId, who.viewer, "VIEWER");
  });

  type Action = () => Promise<{ status: number }>;
  const actions: Record<string, Action> = {
    "view the list": () => call(listById.GET, { params: { id: listId } }),
    "view a task": () => call(taskById.GET, { params: { id: taskId } }),
    "add a task": () => call(tasks.POST, { method: "POST", body: { title: "New", listId } }),
    "complete a task": () =>
      call(taskById.PATCH, { method: "PATCH", params: { id: taskId }, body: { completed: false } }),
    "delete a task": async () => {
      // A fresh task (made by the owner) for every attempt, so attempts don't interfere.
      const current = saveSession();
      const victim = (await createTask(who.owner, listId, "Delete me")).body.task.id;
      switchToSession(current);
      return call(taskById.DELETE, { method: "DELETE", params: { id: victim } });
    },
    "reorder tasks": () =>
      call(reorder.POST, { method: "POST", body: { listId, orderedIds: [taskId] } }),
    "rename the list": () =>
      call(listById.PATCH, { method: "PATCH", params: { id: listId }, body: { name: "Team launch" } }),
    "see members": () => call(members.GET, { params: { id: listId } }),
    "invite someone": () =>
      call(listInvites.POST, {
        method: "POST",
        params: { id: listId },
        body: { email: uniqueEmail("guest"), role: "VIEWER" },
      }),
    "change a member's role": () =>
      call(memberById.PATCH, {
        method: "PATCH",
        params: { id: listId, userId: who.viewer.id },
        body: { role: "VIEWER" },
      }),
  };

  //                              owner  editor viewer outsider
  const expected: Record<string, [number, number, number, number]> = {
    "view the list":            [200,   200,   200,   404],
    "view a task":              [200,   200,   200,   404],
    "add a task":               [201,   201,   403,   404],
    "complete a task":          [200,   200,   403,   404],
    "delete a task":            [204,   204,   403,   404],
    "reorder tasks":            [204,   204,   403,   404],
    "rename the list":          [200,   403,   403,   404],
    "see members":              [200,   200,   200,   404],
    "invite someone":           [201,   403,   403,   404],
    "change a member's role":   [200,   403,   403,   404],
  };

  const roles = ["owner", "editor", "viewer", "outsider"] as const;
  const cases = Object.entries(expected).flatMap(([action, statuses]) =>
    roles.map((role, i) => ({ action, role, status: statuses[i]! })),
  );

  it.each(cases)("$role: $action -> $status", async ({ action, role, status }) => {
    as(who[role]);
    expect((await actions[action]!()).status).toBe(status);
  });

  it("only the owner can delete the list", async () => {
    for (const [role, status] of [["editor", 403], ["viewer", 403], ["outsider", 404]] as const) {
      as(who[role]);
      expect((await call(listById.DELETE, { method: "DELETE", params: { id: listId } })).status).toBe(status);
    }
    as(who.owner);
    expect((await call(listById.DELETE, { method: "DELETE", params: { id: listId } })).status).toBe(204);
    expect(await db.listMember.count({ where: { listId } })).toBe(0);
    expect(await db.listInvite.count({ where: { listId } })).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------

describe("invitations", () => {
  it("an invite can only be accepted by the person it was sent to", async () => {
    const owner = await newUser("Owen");
    const bob = await newUser("Bob");
    const mallory = await newUser("Mallory");
    const list = await createList(owner, "Private plans");

    await invite(owner, list.id, bob.email, "EDITOR");
    const inv = (await pendingInvites(bob))[0]!;
    expect(inv).toMatchObject({ listName: "Private plans", role: "EDITOR", invitedByName: "Owen" });

    expect(await pendingInvites(mallory)).toEqual([]);
    as(mallory);
    expect((await call(acceptInvite.POST, { method: "POST", params: { id: inv.id } })).status).toBe(404);
    expect((await call(listById.GET, { params: { id: list.id } })).status).toBe(404);
  });

  it("gives the same answer whether or not the email has an account, and works once they sign up", async () => {
    const owner = await newUser("Olga");
    const list = await createList(owner, "Book club");
    const existing = await newUser("Existing");
    const futureEmail = uniqueEmail("future");

    const a = await invite(owner, list.id, existing.email, "VIEWER");
    const b = await invite(owner, list.id, futureEmail, "VIEWER");
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);

    const newcomer = await newUser("Newcomer", futureEmail);
    const inv = (await pendingInvites(newcomer)).find((i) => i.listId === list.id)!;
    expect((await call(acceptInvite.POST, { method: "POST", params: { id: inv.id } })).status).toBe(200);
    expect((await call(listById.GET, { params: { id: list.id } })).status).toBe(200);
  });

  it("re-inviting updates the role instead of duplicating the invite", async () => {
    const owner = await newUser("Ophelia");
    const guest = await newUser("Guest");
    const list = await createList(owner, "Garden");
    await invite(owner, list.id, guest.email, "VIEWER");
    await invite(owner, list.id, guest.email.toUpperCase(), "EDITOR");

    const invites = (await pendingInvites(guest)).filter((i) => i.listId === list.id);
    expect(invites).toHaveLength(1);
    expect(invites[0]!.role).toBe("EDITOR");
  });

  it("ignores expired invites", async () => {
    const owner = await newUser("Otto");
    const guest = await newUser("Late");
    const list = await createList(owner, "Old plans");
    await invite(owner, list.id, guest.email, "EDITOR");
    const inv = (await pendingInvites(guest))[0]!;
    await db.listInvite.update({ where: { id: inv.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await pendingInvites(guest)).toEqual([]);
    as(guest);
    expect((await call(acceptInvite.POST, { method: "POST", params: { id: inv.id } })).status).toBe(404);
  });

  it("declining removes the invite without joining", async () => {
    const owner = await newUser("Oona");
    const guest = await newUser("Nope");
    const list = await createList(owner, "Gym");
    await invite(owner, list.id, guest.email, "EDITOR");
    const inv = (await pendingInvites(guest))[0]!;

    expect((await call(declineInvite.POST, { method: "POST", params: { id: inv.id } })).status).toBe(204);
    expect(await pendingInvites(guest)).toEqual([]);
    expect((await call(listById.GET, { params: { id: list.id } })).status).toBe(404);
  });

  it("the owner can see and revoke pending invites; members can't see them", async () => {
    const owner = await newUser("Orla");
    const editor = await newUser("Ed");
    const list = await createList(owner, "Trip");
    await share(owner, list.id, editor, "EDITOR");
    await invite(owner, list.id, uniqueEmail("pending"), "VIEWER");

    as(owner);
    const ownerView = await call<{ invites?: { id: string }[] }>(members.GET, { params: { id: list.id } });
    expect(ownerView.body.invites).toHaveLength(1);

    as(editor);
    const editorView = await call<{ invites?: unknown[] }>(members.GET, { params: { id: list.id } });
    expect(editorView.body.invites).toBeUndefined();

    as(owner);
    const inviteId = ownerView.body.invites![0]!.id;
    const del = await call(listInviteById.DELETE, { method: "DELETE", params: { id: list.id, inviteId } });
    expect(del.status).toBe(204);
    expect(await db.listInvite.count({ where: { listId: list.id } })).toBe(0);
  });

  it("rejects inviting yourself or an existing member", async () => {
    const owner = await newUser("Oliver");
    const member = await newUser("Mem");
    const list = await createList(owner, "Chores");
    await share(owner, list.id, member, "VIEWER");

    expect((await invite(owner, list.id, owner.email, "EDITOR")).status).toBe(400);
    expect((await invite(owner, list.id, member.email, "EDITOR")).status).toBe(400);
  });

  it("caps a list at 20 members and pending invites", async () => {
    const owner = await newUser("Opal");
    const list = await createList(owner, "Huge party");
    await db.listInvite.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        listId: list.id,
        email: `cap-${i}-${Date.now()}@${TEST_EMAIL_DOMAIN}`,
        role: "VIEWER" as const,
        invitedById: owner.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    });
    expect((await invite(owner, list.id, uniqueEmail("one-more"), "VIEWER")).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------------------------

describe("membership changes", () => {
  it("a removed member loses access immediately", async () => {
    const owner = await newUser("Omar");
    const ex = await newUser("Ex");
    const list = await createList(owner, "Secrets");
    await share(owner, list.id, ex, "EDITOR");

    as(owner);
    const res = await call(memberById.DELETE, { method: "DELETE", params: { id: list.id, userId: ex.id } });
    expect(res.status).toBe(204);

    as(ex);
    expect((await call(listById.GET, { params: { id: list.id } })).status).toBe(404);
  });

  it("members can leave; the owner can't", async () => {
    const owner = await newUser("Odin");
    const leaver = await newUser("Leaver");
    const list = await createList(owner, "Club");
    await share(owner, list.id, leaver, "VIEWER");

    as(leaver);
    const left = await call(memberById.DELETE, { method: "DELETE", params: { id: list.id, userId: leaver.id } });
    expect(left.status).toBe(204);
    expect((await call(listById.GET, { params: { id: list.id } })).status).toBe(404);

    as(owner);
    const ownerLeave = await call(memberById.DELETE, {
      method: "DELETE",
      params: { id: list.id, userId: owner.id },
    });
    expect(ownerLeave.status).toBe(400);
  });

  it("changing a role takes effect immediately", async () => {
    const owner = await newUser("Opie");
    const eve = await newUser("Eve");
    const list = await createList(owner, "Shopping");
    await share(owner, list.id, eve, "EDITOR");
    expect((await createTask(eve, list.id, "Milk")).status).toBe(201);

    as(owner);
    await call(memberById.PATCH, {
      method: "PATCH",
      params: { id: list.id, userId: eve.id },
      body: { role: "VIEWER" },
    });
    expect((await createTask(eve, list.id, "Eggs")).status).toBe(403);
  });

  it("deleting the owner's account removes the list for everyone", async () => {
    const owner = await newUser("Orson");
    const member = await newUser("Stays");
    const list = await createList(owner, "Doomed");
    await share(owner, list.id, member, "EDITOR");

    as(owner);
    expect((await call(account.DELETE, { method: "DELETE", body: { password: PASSWORD } })).status).toBe(204);

    as(member);
    expect((await call(listById.GET, { params: { id: list.id } })).status).toBe(404);
  });

  it("a collaborator's tasks survive when they delete their account", async () => {
    const owner = await newUser("Octavia");
    const helper = await newUser("Helper");
    const list = await createList(owner, "Kept");
    await share(owner, list.id, helper, "EDITOR");
    const t = (await createTask(helper, list.id, "Added by helper")).body.task;

    as(helper);
    await call(account.DELETE, { method: "DELETE", body: { password: PASSWORD } });

    as(owner);
    const res = await call<{ task: Task }>(taskById.GET, { params: { id: t.id } });
    expect(res.status).toBe(200);
    expect(res.body.task.createdByName).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------

describe("shared lists in the app's views", () => {
  it("shows shared lists with the viewer's role, owner name and member count", async () => {
    const owner = await newUser("Ophira");
    const member = await newUser("Member");
    const list = await createList(owner, "Road trip");
    await share(owner, list.id, member, "VIEWER");

    as(member);
    const mine = (await call<{ lists: List[] }>(lists.GET)).body.lists;
    const shared = mine.find((l) => l.id === list.id)!;
    expect(shared).toMatchObject({ role: "VIEWER", ownerName: "Ophira", memberCount: 1 });
    expect(mine.find((l) => l.id !== list.id)!.role).toBe("OWNER"); // their own "My Tasks"
  });

  it("tells the owner about pending invites so their page can start refreshing", async () => {
    const owner = await newUser("Oakley");
    const list = await createList(owner, "Pending");
    await invite(owner, list.id, uniqueEmail("later"), "EDITOR");

    as(owner);
    const mine = (await call<{ lists: (List & { pendingInviteCount: number })[] }>(lists.GET)).body.lists;
    expect(mine.find((l) => l.id === list.id)).toMatchObject({ memberCount: 0, pendingInviteCount: 1 });
  });

  it("includes shared tasks in Today and search, with who added them", async () => {
    const owner = await newUser("Oriel");
    const member = await newUser("Mira");
    const list = await createList(owner, "Launch");
    await share(owner, list.id, member, "EDITOR");
    await createTask(owner, list.id, "Shared deadline zebra", { dueDate: "2026-09-21" });

    as(member);
    const today = await call<{ tasks: Task[] }>(tasks.GET, { search: { view: "today", today: "2026-09-21" } });
    const found = today.body.tasks.find((t) => t.title === "Shared deadline zebra");
    expect(found?.createdByName).toBe("Oriel");

    const search = await call<{ tasks: Task[] }>(tasks.GET, { search: { q: "zebra" } });
    expect(search.body.tasks.map((t) => t.title)).toEqual(["Shared deadline zebra"]);
  });

  it("a viewer can't move their own task into the shared list", async () => {
    const owner = await newUser("Oren");
    const viewer = await newUser("Viv");
    const list = await createList(owner, "Read only");
    await share(owner, list.id, viewer, "VIEWER");

    as(viewer);
    const myList = (await call<{ lists: List[] }>(lists.GET)).body.lists.find((l) => l.role === "OWNER")!;
    const mine = (await createTask(viewer, myList.id, "Mine")).body.task;
    as(viewer);
    const move = await call(taskById.PATCH, {
      method: "PATCH",
      params: { id: mine.id },
      body: { listId: list.id },
    });
    expect(move.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------------------------

describe("demo showcase", () => {
  it("gives every demo visitor a list shared with them and a pending invitation", async () => {
    const demo = await import("@/app/api/auth/demo/route");
    jar.clear();
    const res = await call<{ user: { id: string } }>(demo.POST, { method: "POST" });
    expect(res.status).toBe(201);

    const mine = (await call<{ lists: List[] }>(lists.GET)).body.lists;
    const shared = mine.find((l) => l.role !== "OWNER");
    expect(shared).toMatchObject({ role: "EDITOR", ownerName: "Sam (demo)" });

    const sharedTasks = (await call<{ tasks: Task[] }>(tasks.GET, { search: { listId: shared!.id } })).body.tasks;
    expect(new Set(sharedTasks.map((t) => t.createdByName))).toEqual(new Set(["Sam (demo)", "Demo User"]));

    const invites = (await call<{ invites: Invite[] }>(myInvites.GET)).body.invites;
    expect(invites).toHaveLength(1);
    expect(invites[0]!.invitedByName).toBe("Sam (demo)");

    // Clean up the visitor and their companion (both are demo accounts).
    const companionIds = (await db.list.findMany({ where: { id: shared!.id }, select: { userId: true } })).map((l) => l.userId);
    await db.user.deleteMany({ where: { id: { in: [res.body.user.id, ...companionIds] } } });
  });
});
