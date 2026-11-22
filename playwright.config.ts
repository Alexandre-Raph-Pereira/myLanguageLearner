import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// e2e runs without Supabase: dev-only auth bypass + embedded PGlite database.
const serverEnv = {
  AI_MOCK: "1",
  DEV_USER_ID: "00000000-0000-4000-8000-0000000000e2",
  DATABASE_URL: "pglite://./.pglite-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "off",
    // Matches the seeded timezone so <TimezoneSync> does not move the e2e user's days.
    timezoneId: "UTC",
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `node --conditions=react-server --import tsx e2e/prepare-db.ts && pnpm exec next dev --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: serverEnv,
  },
});
