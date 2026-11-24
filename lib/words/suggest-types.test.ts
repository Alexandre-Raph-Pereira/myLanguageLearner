import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiUsage, modelPricing, userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { getMockCalls, resetMockFixtures } from "@/lib/ai/mock";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { estimateSuggestTypes, suggestTypes } from "./suggest-types";

const me = { userId: TEST_USER_ID, language: "ko" as const };
let db: Db;

beforeEach(async () => {
  resetMockFixtures();
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

const rows = Array.from({ length: 9 }, (_, i) => ({ i, term: `단어${i}`, meaning: `word ${i}` }));

describe("suggestTypes", () => {
  it("returns a type per known row id (mock fixture) and logs usage", async () => {
    const out = await suggestTypes(db, me, rows);
    expect(out).toHaveLength(9);
    expect(out.find((r) => r.i === 2)?.type).toBe("verb");
    expect(out.some((r) => r.i === 9999)).toBe(false);
    const usage = await db.select().from(aiUsage);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ task: "words.suggest_types", status: "ok" });
  });

  it("splits into chunks of 200 within one operation", async () => {
    const many = Array.from({ length: 450 }, (_, i) => ({ i, term: "가", meaning: "x" }));
    await suggestTypes(db, me, many);
    expect(getMockCalls("words.suggest_types")).toHaveLength(3);
    const usage = await db.select().from(aiUsage);
    expect(new Set(usage.map((u) => u.operationId)).size).toBe(1);
  });

  it("estimates cost before running", async () => {
    const est = await estimateSuggestTypes(db, me, rows);
    expect(est.calls).toBe(1);
    expect(est.usd).toBeGreaterThan(0);
    await db.delete(modelPricing);
    expect((await estimateSuggestTypes(db, me, rows)).usd).toBeNull();
  });

  it("needs no price with Claude Code (included in the plan)", async () => {
    vi.stubEnv("AI_PROVIDER", "claude-code");
    await db.delete(modelPricing);
    const est = await estimateSuggestTypes(db, me, rows);
    expect(est).toMatchObject({ usd: 0, calls: 1, included: true });
    vi.unstubAllEnvs();
  });
});
