import { expect, test, type Browser, type Page } from "@playwright/test";

const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.getitdone.local`;

async function signUp(browser: Browser, name: string, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app\/today/);
  return page;
}

async function openMenuIfMobile(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
}

test("share a list: invite, accept, collaborate, then downgrade to view-only", async ({
  browser,
}) => {
  test.slow(); // two users, several round trips

  const bobEmail = uniqueEmail("bob");
  const bob = await signUp(browser, "Bob Builder", bobEmail);
  const alice = await signUp(browser, "Alice Owner", uniqueEmail("alice"));

  // Alice creates a list and invites Bob as an editor.
  await openMenuIfMobile(alice);
  await alice.getByRole("button", { name: "New list" }).click();
  await alice.getByLabel("Name").fill("Moving house");
  await alice.getByRole("button", { name: "Create list" }).click();
  await expect(alice.getByRole("heading", { name: "Moving house", level: 1 })).toBeVisible();

  await alice.getByRole("button", { name: /Share/ }).click();
  const share = alice.getByRole("dialog", { name: /Share/ });
  await share.getByLabel("Email to invite").fill(bobEmail);
  await share.getByRole("button", { name: "Invite" }).click();
  await expect(share.getByText(bobEmail)).toBeVisible();
  await alice.keyboard.press("Escape");

  // Bob sees the invitation and accepts it.
  await bob.reload();
  await openMenuIfMobile(bob);
  await bob.getByRole("button", { name: /Invitations/ }).click();
  await bob.getByRole("button", { name: "Accept" }).click();
  await expect(bob.getByRole("heading", { name: "Moving house", level: 1 })).toBeVisible();
  await expect(bob.getByText(/Shared by Alice Owner/)).toBeVisible();

  // Bob adds a task; Alice sees it without doing anything (the shared list refreshes itself).
  const input = bob.getByLabel("New task title");
  await input.fill("Pack the kitchen");
  await input.press("Enter");
  await expect(bob.getByRole("button", { name: /^Pack the kitchen/ })).toBeVisible();

  await expect(alice.getByRole("button", { name: /^Pack the kitchen/ })).toBeVisible({
    timeout: 20_000,
  });
  await expect(alice.getByText("Bob Builder")).toBeVisible(); // "added by"

  // Alice makes Bob a viewer; Bob's editing controls disappear.
  await alice.getByRole("button", { name: /Share/ }).click();
  const roleSelect = alice.getByRole("combobox", { name: "Role for Bob Builder" });
  await roleSelect.scrollIntoViewIfNeeded();
  await roleSelect.click();
  await alice.getByRole("option", { name: "Can view" }).click();
  await expect(alice.getByText("Role updated")).toBeVisible();
  await alice.keyboard.press("Escape");

  await bob.reload();
  await expect(bob.getByText(/View only/).first()).toBeVisible();
  await expect(bob.getByLabel("New task title")).toHaveCount(0);
  await expect(bob.getByRole("checkbox", { name: /Pack the kitchen/ })).toBeDisabled();

  // A viewer can still open a task to read it, but not change it.
  await bob.getByRole("button", { name: /^Pack the kitchen/ }).click();
  const details = bob.getByRole("dialog", { name: "Pack the kitchen" });
  await expect(details.getByText("View only")).toBeVisible();
  await expect(details.getByRole("button", { name: "Save" })).toHaveCount(0);
});
