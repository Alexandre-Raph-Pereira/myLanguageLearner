import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiUsage, modelPricing, userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { assertBudget, createOperation, monthSpent, startOfUtcMonth } from "./budget";
import { BudgetError } from "./errors";
import { estimateCost, estimateInputTokens, IMAGE_TOKENS } from "./estimate";
import { loadFixture, resetMockFixtures, setMockFixture } from "./mock";
import { costOf } from "./pricing";
import { resolveModelChoice } from "./providers";
import { aiObject, aiText, type AiObjectOptions } from "./run";

const PRICING = { inputPerMtok: 3, outputPerMtok: 15, cacheReadPerMtok: 0.3 };
const schema = z.object({ word: z.string(), meaning: z.string() });

let db: Db;

beforeEach(async () => {
  vi.stubEnv("AI_MOCK", "1");
  resetMockFixtures();
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

function call(
  task: string,
  overrides: Partial<Omit<AiObjectOptions<typeof schema>, "prompt" | "messages">> = {},
) {
  return aiObject({
    db,
    userId: TEST_USER_ID,
    operation: createOperation(TEST_USER_ID, "test"),
    task,
    tier: "smart",
    schema,
    system: "You are a test.",
    prompt: "Give me a word.",
    maxOutputTokens: 500,
    ...overrides,
  });
}

const usageRows = () => db.select().from(aiUsage).orderBy(aiUsage.createdAt);

describe("estimate", () => {
  it("counts Hangul as 1 token, latin as 1/3.5, images 1,600", () => {
    expect(estimateInputTokens({ text: "사과" })).toBe(2);
    expect(estimateInputTokens({ text: "abcdefg" })).toBe(2);
    expect(estimateInputTokens({ text: "", images: 2 })).toBe(2 * IMAGE_TOKENS);
  });

  it("upper-bound cost uses all output tokens", () => {
    expect(estimateCost(1_000_000, 1_000_000, PRICING)).toBe(18);
  });
});

describe("costOf", () => {
  it("bills cached input at the cache-read rate", () => {
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 }, PRICING)).toBe(
      3,
    );
    expect(
      costOf(
        { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 1_000_000 },
        PRICING,
      ),
    ).toBeCloseTo(15.3);
    expect(
      costOf(
        { inputTokens: 100, outputTokens: 0, cachedInputTokens: 100 },
        { ...PRICING, cacheReadPerMtok: null },
      ),
    ).toBeCloseTo(0.0003);
  });
});

describe("budget", () => {
  const caps = { budgetPerRequestUsd: 0.5, budgetMonthlyUsd: 10 };

  it("blocks over the per-request cap (including what the operation already spent)", async () => {
    const op = createOperation(TEST_USER_ID, "x");
    await expect(assertBudget(db, op, 0.4, caps)).resolves.toBeUndefined();
    op.spentActual = 0.2;
    await expect(assertBudget(db, op, 0.4, caps)).rejects.toBeInstanceOf(BudgetError);
  });

  it("blocks over the monthly cap using this UTC month's real cost only", async () => {
    const now = new Date("2026-11-21T12:00:00Z");
    const base = {
      operationId: crypto.randomUUID(),
      task: "t",
      provider: "p",
      model: "m",
      status: "ok" as const,
    };
    await db.insert(aiUsage).values([
      { ...base, userId: TEST_USER_ID, costUsd: 9.8, createdAt: new Date("2026-11-02T00:00:00Z") },
      { ...base, userId: TEST_USER_ID, costUsd: 50, createdAt: new Date("2026-10-31T23:59:59Z") },
      { ...base, userId: OTHER_USER_ID, costUsd: 50, createdAt: new Date("2026-11-03T00:00:00Z") },
    ]);
    expect(await monthSpent(db, TEST_USER_ID, now)).toBeCloseTo(9.8);
    const op = createOperation(TEST_USER_ID, "x");
    await expect(assertBudget(db, op, 0.1, caps, now)).resolves.toBeUndefined();
    await expect(assertBudget(db, op, 0.3, caps, now)).rejects.toThrow(/Monthly AI budget/);
  });

  it("month starts at UTC midnight on the 1st", () => {
    expect(startOfUtcMonth(new Date("2026-03-01T00:30:00+02:00")).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });
});

describe("providers", () => {
  it("settings override env defaults; null falls back", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_MODEL_FAST", "");
    expect(resolveModelChoice("fast", null)).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-5-5",
    });
    expect(
      resolveModelChoice("smart", {
        aiProvider: "openai",
        aiModelSmart: "gpt-x",
        aiModelFast: null,
      }),
    ).toEqual({ provider: "openai", modelId: "gpt-x" });
    expect(
      resolveModelChoice("fast", { aiProvider: "bogus", aiModelSmart: null, aiModelFast: " " }),
    ).toEqual({ provider: "anthropic", modelId: "claude-sonnet-5-5" });
  });
});

describe("mock mode", () => {
  it("reads fixtures from tests/fixtures/ai/<task>.json", () => {
    expect(loadFixture("test.echo").responses).toHaveLength(1);
    expect(() => loadFixture("does.not.exist")).toThrow(/no fixture/);
    expect(() => loadFixture("../etc/passwd")).toThrow(/Invalid AI task/);
  });
});

describe("aiObject", () => {
  it("returns validated output and logs real usage + cost", async () => {
    const op = createOperation(TEST_USER_ID, "test");
    await expect(call("test.echo", { operation: op })).resolves.toEqual({
      word: "사과",
      meaning: "apple",
    });
    const rows = await usageRows();
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      userId: TEST_USER_ID,
      operationId: op.id,
      task: "test.echo",
      provider: "mock:anthropic",
      model: "claude-sonnet-5-5",
      status: "ok",
      inputTokens: 200,
      outputTokens: 40,
    });
    const expected = (200 * 3 + 40 * 15) / 1e6;
    expect(row.costUsd).toBeCloseTo(expected, 6);
    expect(row.estimatedCostUsd).toBeGreaterThan(row.costUsd);
    expect(op.spentActual).toBeCloseTo(expected, 9);
  });

  it("retries once on invalid JSON / schema mismatch, then succeeds", async () => {
    setMockFixture("t.retry", {
      responses: ["not json at all", { word: "물", meaning: "water" }],
    });
    await expect(call("t.retry")).resolves.toEqual({ word: "물", meaning: "water" });
    const rows = await usageRows();
    expect(rows.map((r) => r.status)).toEqual(["error", "ok"]);
    expect(rows[0].error).toMatch(/invalid output/);
  });

  it("fails after a second invalid answer", async () => {
    setMockFixture("t.bad", { responses: [{ word: 1 }, { nope: true }] });
    await expect(call("t.bad")).rejects.toThrow(/invalid answer twice/);
    expect((await usageRows()).map((r) => r.status)).toEqual(["error", "error"]);
  });

  it("blocks over the per-request cap and logs a blocked row", async () => {
    await db
      .update(userSettings)
      .set({ budgetPerRequestUsd: 0.001 })
      .where(eq(userSettings.userId, TEST_USER_ID));
    await expect(call("test.echo", { maxOutputTokens: 10_000 })).rejects.toBeInstanceOf(
      BudgetError,
    );
    const rows = await usageRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "blocked", costUsd: 0 });
    expect(rows[0].estimatedCostUsd).toBeGreaterThan(0.001);
  });

  it("blocks over the monthly cap", async () => {
    await db
      .update(userSettings)
      .set({ budgetMonthlyUsd: 1 })
      .where(eq(userSettings.userId, TEST_USER_ID));
    await db.insert(aiUsage).values({
      userId: TEST_USER_ID,
      operationId: crypto.randomUUID(),
      task: "earlier",
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      costUsd: 0.999,
      status: "ok",
    });
    await expect(call("test.echo")).rejects.toThrow(/Monthly AI budget/);
  });

  it("blocks when the model has no pricing row", async () => {
    await db.delete(modelPricing);
    await expect(call("test.echo")).rejects.toThrow(/No pricing for model claude-sonnet-5-5/);
    expect((await usageRows())[0].status).toBe("blocked");
  });

  it("shares the per-request cap across calls of one operation", async () => {
    // Each call: estimate ≈ 500 out × $15/M ≈ $0.0075; actual ≈ $0.0012.
    await db
      .update(userSettings)
      .set({ budgetPerRequestUsd: 0.009 })
      .where(eq(userSettings.userId, TEST_USER_ID));
    const op = createOperation(TEST_USER_ID, "multi");
    await call("test.echo", { operation: op });
    await call("test.echo", { operation: op });
    await expect(call("test.echo", { operation: op })).rejects.toBeInstanceOf(BudgetError);
  });

  it("rejects an operation of another user", async () => {
    await expect(
      call("test.echo", { operation: createOperation(OTHER_USER_ID, "x") }),
    ).rejects.toThrow(/another user/);
  });

  it("sends images as file parts and counts them in the estimate", async () => {
    await call("test.echo", { images: [{ data: "aGVsbG8=", mediaType: "image/png" }] });
    const [row] = await usageRows();
    expect(row.estimatedCostUsd).toBeGreaterThan((IMAGE_TOKENS * 3) / 1e6);
  });
});

describe("aiText", () => {
  it("returns text and logs usage", async () => {
    const text = await aiText({
      db,
      userId: TEST_USER_ID,
      operation: createOperation(TEST_USER_ID, "grade"),
      task: "test.text",
      tier: "fast",
      system: "Grade.",
      prompt: "사과 = apple?",
      maxOutputTokens: 200,
      cacheSystem: true,
    });
    expect(text).toContain("apple");
    expect((await usageRows())[0]).toMatchObject({ status: "ok", task: "test.text" });
  });
});
