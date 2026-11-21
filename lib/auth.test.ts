import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb, TEST_USER_ID } from "@/tests/db";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

const testDb = createTestDb();
vi.mock("@/db", () => ({ getDb: () => testDb }));

afterEach(() => {
  vi.unstubAllEnvs();
  redirect.mockClear();
});

describe("requireUser", () => {
  it("dev bypass returns DEV_USER_ID and bootstraps rows", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DEV_USER_ID", TEST_USER_ID);
    const { requireUser } = await import("./auth");
    await expect(requireUser()).resolves.toEqual({ id: TEST_USER_ID, email: "dev@localhost" });
    const { userSettings } = await import("@/db/schema");
    expect(await (await testDb).select().from(userSettings)).toHaveLength(1);
  });

  it("redirects pages / throws 401 for handlers when signed out", async () => {
    vi.stubEnv("DEV_USER_ID", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { requireUser, UnauthorizedError } = await import("./auth");
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(requireUser({ throwOnMissing: true })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("ignores DEV_USER_ID in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_USER_ID", TEST_USER_ID);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { requireUser } = await import("./auth");
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
