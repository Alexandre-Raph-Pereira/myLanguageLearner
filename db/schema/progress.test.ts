import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { languageProfiles, userSettings } from "./core";
import { activityEvents } from "./progress";

describe("progress schema on PGlite", () => {
  it("adds motivation defaults to settings and language profiles", async () => {
    const db = await createTestDb();
    await db.insert(userSettings).values({ userId: TEST_USER_ID });
    await db.insert(languageProfiles).values({ userId: TEST_USER_ID, language: "ko" });
    const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, TEST_USER_ID));
    expect(s).toMatchObject({ timezone: "UTC", showPoints: true, celebrateMilestones: true });
    const [p] = await db.select().from(languageProfiles);
    expect(p).toMatchObject({
      dailyGoalWords: 20,
      dailyGoalGrammar: 1,
      pointsTotal: 0,
      bestStreak: 0,
    });
  });

  it("rejects daily goals outside the allowed range", async () => {
    const db = await createTestDb();
    await expect(
      db
        .insert(languageProfiles)
        .values({ userId: TEST_USER_ID, language: "ko", dailyGoalWords: 2 }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(languageProfiles)
        .values({ userId: TEST_USER_ID, language: "ko", dailyGoalGrammar: 6 }),
    ).rejects.toThrow();
  });

  it("dedupe_key is unique per user only when set", async () => {
    const db = await createTestDb();
    const base = { language: "ko", kind: "word_answer" as const, localDate: "2026-11-22" };
    await db.insert(activityEvents).values([
      { ...base, userId: TEST_USER_ID },
      { ...base, userId: TEST_USER_ID },
      { ...base, userId: TEST_USER_ID, dedupeKey: "k" },
      { ...base, userId: OTHER_USER_ID, dedupeKey: "k" },
    ]);
    await expect(
      db.insert(activityEvents).values({ ...base, userId: TEST_USER_ID, dedupeKey: "k" }),
    ).rejects.toThrow();
  });
});
