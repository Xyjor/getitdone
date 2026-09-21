import { expect, test, type Page } from "@playwright/test";

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.getitdone.local`;

async function openMenuIfMobile(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
}

test("redirects to login when not signed in", async ({ page }) => {
  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ftoday/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("shows validation errors on the sign-up form", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
});

test("full flow: sign up, manage a list and tasks, log out, log back in", async ({ page }) => {
  const email = uniqueEmail();

  // Sign up
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

  // Create a list
  await openMenuIfMobile(page);
  await page.getByRole("button", { name: "New list" }).click();
  await page.getByLabel("Name").fill("Groceries");
  await page.getByRole("radio", { name: "green" }).click();
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page.getByRole("heading", { name: "Groceries", level: 1 })).toBeVisible();

  // Add tasks
  const input = page.getByLabel("New task title");
  await input.fill("Buy apples");
  await input.press("Enter");
  await input.fill("Buy bread");
  await input.press("Enter");
  const apples = page.getByRole("listitem").filter({ hasText: "Buy apples" });
  await expect(apples).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Buy bread" })).toBeVisible();

  // Complete a task
  await apples.getByRole("checkbox").click();
  await expect(page.getByRole("button", { name: /Completed/ })).toBeVisible();

  // Edit a task
  await page.getByRole("button", { name: "Buy bread", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  await dialog.getByLabel("Title").fill("Buy sourdough bread");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Buy sourdough bread", exact: true })).toBeVisible();

  // Delete a task
  await page.getByRole("button", { name: 'Options for "Buy sourdough bread"' }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Buy sourdough bread", exact: true })).toHaveCount(0);

  // Data survives a reload (it's really in the database)
  await page.reload();
  await page.getByRole("button", { name: /Completed/ }).click();
  await expect(page.getByRole("button", { name: "Buy apples", exact: true })).toBeVisible();

  // Log out
  await openMenuIfMobile(page);
  await page.getByRole("button", { name: /E2E Tester/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Log back in
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app/);
  await openMenuIfMobile(page);
  await expect(page.getByRole("link", { name: /Groceries/ })).toBeVisible();
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText("Invalid email or password");
});

test("demo button opens a pre-filled sandbox", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the live demo" }).click();
  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByRole("button", { name: /^Prepare sprint demo/ })).toBeVisible();
});
