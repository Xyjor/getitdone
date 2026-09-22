import { expect, test, type Browser } from "@playwright/test";

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.getitdone.local`;

async function signUpIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.getByLabel("Name").fill("Settings Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app\/today/);
  return page;
}

async function logInIn(browser: Browser, email: string, password = "password123") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app/);
  return page;
}

test("signing out another device from Settings logs that device out", async ({ browser }) => {
  const email = uniqueEmail();
  const laptop = await signUpIn(browser, email);
  const phone = await logInIn(browser, email);

  await laptop.goto("/app/settings");
  await expect(laptop.getByText("This device")).toBeVisible();
  await laptop.getByRole("button", { name: "Sign out all other devices" }).click();
  await expect(laptop.getByText("Signed out of all other devices")).toBeVisible();

  await phone.goto("/app/today");
  await expect(phone).toHaveURL(/\/login/);

  // The laptop is still signed in.
  await laptop.goto("/app/today");
  await expect(laptop.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
});

test("changing the password works and the old one stops working", async ({ browser }) => {
  const email = uniqueEmail();
  const page = await signUpIn(browser, email);

  await page.goto("/app/settings");
  await page.getByLabel("Name").fill("Renamed Tester");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Name updated")).toBeVisible();

  await page.getByLabel("Current password").fill("password123");
  await page.getByLabel("New password").fill("even-better-password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  const other = await (await browser.newContext()).newPage();
  await other.goto("/login");
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password").fill("password123");
  await other.getByRole("button", { name: "Log in" }).click();
  await expect(other.getByRole("alert").filter({ hasText: /./ })).toHaveText("Invalid email or password");

  await logInIn(browser, email, "even-better-password");
});

test("repeated wrong passwords lock the account temporarily", async ({ page }) => {
  await page.goto("/login");
  const email = uniqueEmail();
  await page.getByLabel("Email").fill(email);
  for (let i = 0; i < 6; i++) {
    await page.getByLabel("Password").fill(`wrong-${i}`);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
  }
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toContainText("Too many attempts");
});
