import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/types";
import { isPublicPath } from "@/lib/auth-rules";
import { createTestDb } from "@/tests/db";

let db: Db | null;
vi.mock("@/db", () => ({
  getDb: async () => {
    if (!db) throw new Error("no database");
    return db;
  },
}));

const { GET } = await import("./route");

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("is public", () => {
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("reports ok with the database and the mock AI", async () => {
    vi.stubEnv("APP_COMMIT", "abc1234");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      version: "abc1234",
      db: "ok",
      ai: { provider: "mock", ready: true },
    });
  });

  it("returns 503 when the database is down", async () => {
    db = null;
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).db).toBe("error");
  });

  it("checks the Claude Code CLI without leaking anything", async () => {
    vi.stubEnv("AI_MOCK", "0");
    vi.stubEnv("AI_PROVIDER", "claude-code");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-secret");
    vi.stubEnv(
      "CLAUDE_CODE_BIN",
      path.resolve(__dirname, "../../../tests/fixtures/claude-code/fake-claude.mjs"),
    );
    vi.stubEnv("CLAUDE_AGENTS_DIR", path.resolve(__dirname, "../../../langlearner-agents"));
    const res = await GET();
    const text = await res.text();
    expect(JSON.parse(text).ai).toEqual({ provider: "claude-code", ready: true });
    expect(text).not.toContain("sk-secret");
  });
});
