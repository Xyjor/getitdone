import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" throws outside a React Server Components bundle; it's a no-op in tests.
    alias: { "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database, so run files one at a time.
    fileParallelism: false,
    // Integration tests talk to a real (possibly remote) database.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
