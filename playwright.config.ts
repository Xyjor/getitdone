import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// Each worker pretends to be a different client IP so repeated local runs don't hit the
// per-IP rate limits. (On Vercel this header is overwritten by the platform, so it can't be spoofed.)
const r = () => Math.floor(Math.random() * 256);
const workerIp = `10.${r()}.${r()}.${r()}`;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // The dev database may be remote, so allow a little longer than the 5s default.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": workerIp },
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Starts the app automatically unless you point E2E_BASE_URL at a running server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
