import { beforeEach, describe, expect, it } from "vitest";
import { aiUsage } from "@/db/schema";
import type { Db } from "@/db/types";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { ensureUserRows } from "./user-bootstrap";
import {
  aiSettingsInput,
  budgetsInput,
  getLanguageProfile,
  getPricingRows,
  getUserSettings,
  languageProfileInput,
  pricingInput,
  recentUsage,
  saveAiSettings,
  saveBudgets,
  saveLanguageProfile,
  savePricing,
} from "./settings";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await ensureUserRows(db, TEST_USER_ID);
  await ensureUserRows(db, OTHER_USER_ID);
});

describe("settings", () => {
  it("saves the target level for one user only", async () => {
    await saveLanguageProfile(
      db,
      TEST_USER_ID,
      languageProfileInput.parse({ language: "ko", targetLevel: "4" }),
    );
    expect((await getLanguageProfile(db, TEST_USER_ID, "ko"))?.targetLevel).toBe(4);
    expect((await getLanguageProfile(db, OTHER_USER_ID, "ko"))?.targetLevel).toBeNull();
  });

  it("validates the target level range", () => {
    expect(languageProfileInput.safeParse({ language: "ko", targetLevel: 7 }).success).toBe(false);
    expect(languageProfileInput.safeParse({ language: "xx", targetLevel: 1 }).success).toBe(false);
  });

  it("stores AI overrides, empty strings mean 'use env default'", async () => {
    await saveAiSettings(
      db,
      TEST_USER_ID,
      aiSettingsInput.parse({ aiProvider: "openai", aiModelSmart: " gpt-x ", aiModelFast: "" }),
    );
    const s = await getUserSettings(db, TEST_USER_ID);
    expect(s).toMatchObject({ aiProvider: "openai", aiModelSmart: "gpt-x", aiModelFast: null });
    await saveAiSettings(
      db,
      TEST_USER_ID,
      aiSettingsInput.parse({ aiProvider: "", aiModelSmart: "", aiModelFast: "" }),
    );
    expect((await getUserSettings(db, TEST_USER_ID)).aiProvider).toBeNull();
  });

  it("saves budgets and rejects non-positive values", async () => {
    await saveBudgets(
      db,
      TEST_USER_ID,
      budgetsInput.parse({ budgetPerRequestUsd: "0.25", budgetMonthlyUsd: "20" }),
    );
    expect(await getUserSettings(db, TEST_USER_ID)).toMatchObject({
      budgetPerRequestUsd: 0.25,
      budgetMonthlyUsd: 20,
    });
    expect(budgetsInput.safeParse({ budgetPerRequestUsd: 0, budgetMonthlyUsd: 1 }).success).toBe(
      false,
    );
  });

  it("saving pricing marks it verified", async () => {
    const [before] = await getPricingRows(db, ["claude-sonnet-5-5"]);
    expect(before.verified).toBe(false);
    await savePricing(
      db,
      pricingInput.parse({
        modelId: "claude-sonnet-5-5",
        inputPerMtok: "3",
        outputPerMtok: "15",
        cacheReadPerMtok: "",
      }),
    );
    const [after] = await getPricingRows(db, ["claude-sonnet-5-5"]);
    expect(after).toMatchObject({ verified: true, cacheReadPerMtok: null });
  });

  it("lists the user's last usage rows only, newest first", async () => {
    const base = {
      operationId: crypto.randomUUID(),
      task: "t",
      provider: "p",
      model: "m",
      status: "ok" as const,
    };
    await db.insert(aiUsage).values([
      { ...base, userId: TEST_USER_ID, task: "old", createdAt: new Date("2026-01-01") },
      { ...base, userId: TEST_USER_ID, task: "new", createdAt: new Date("2026-02-01") },
      { ...base, userId: OTHER_USER_ID, task: "other" },
    ]);
    expect((await recentUsage(db, TEST_USER_ID)).map((r) => r.task)).toEqual(["new", "old"]);
  });
});
