import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: { "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    setupFiles: ["./tests/setup.ts"],
    env: { AI_MOCK: "1" },
    // Each PGlite test DB boots Postgres + runs migrations: slow on loaded / WSL machines.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Component tests opt into jsdom with `// @vitest-environment jsdom`.
  },
});
