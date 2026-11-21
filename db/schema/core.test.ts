import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { modelPricing, userSettings } from "./core";

describe("core schema on PGlite", () => {
  it("inserts and reads user_settings with defaults", async () => {
    const db = await createTestDb();
    await db.insert(userSettings).values({ userId: TEST_USER_ID });
    const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, TEST_USER_ID));
    expect(row.nativeLanguage).toBe("en");
    expect(row.activeLanguage).toBe("ko");
    expect(row.budgetPerRequestUsd).toBe(0.5);
    expect(row.budgetMonthlyUsd).toBe(10);
    expect(row.aiProvider).toBeNull();
  });

  it("seeds an unverified pricing row for the default model", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(modelPricing);
    expect(rows).toEqual([
      expect.objectContaining({ modelId: "claude-sonnet-5-5", verified: false, inputPerMtok: 3 }),
    ]);
  });
});
