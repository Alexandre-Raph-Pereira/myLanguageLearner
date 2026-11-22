import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { ensureUserRows } from "./user-bootstrap";
import {
  dailyGoalInput,
  getLanguageProfile,
  getUserSettings,
  isSupportedTimezone,
  motivationInput,
  saveDailyGoal,
  saveMotivation,
  saveTimezone,
  timezoneInput,
} from "./settings";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await ensureUserRows(db, TEST_USER_ID);
  await ensureUserRows(db, OTHER_USER_ID);
});

describe("daily goal settings", () => {
  it("validates ranges", () => {
    const ok = dailyGoalInput.safeParse({
      language: "ko",
      dailyGoalWords: "25",
      dailyGoalGrammar: "0",
    });
    expect(ok.success && ok.data).toEqual({
      language: "ko",
      dailyGoalWords: 25,
      dailyGoalGrammar: 0,
    });
    expect(
      dailyGoalInput.safeParse({ language: "ko", dailyGoalWords: 4, dailyGoalGrammar: 1 }).success,
    ).toBe(false);
    expect(
      dailyGoalInput.safeParse({ language: "ko", dailyGoalWords: 205, dailyGoalGrammar: 1 })
        .success,
    ).toBe(false);
    expect(
      dailyGoalInput.safeParse({ language: "ko", dailyGoalWords: 20, dailyGoalGrammar: 6 }).success,
    ).toBe(false);
  });

  it("saves for one user only", async () => {
    await saveDailyGoal(db, TEST_USER_ID, {
      language: "ko",
      dailyGoalWords: 30,
      dailyGoalGrammar: 2,
    });
    expect(await getLanguageProfile(db, TEST_USER_ID, "ko")).toMatchObject({
      dailyGoalWords: 30,
      dailyGoalGrammar: 2,
    });
    expect(await getLanguageProfile(db, OTHER_USER_ID, "ko")).toMatchObject({ dailyGoalWords: 20 });
  });
});

describe("motivation settings", () => {
  it("parses checkboxes (absent = off)", () => {
    expect(motivationInput.parse({ showPoints: "on" })).toEqual({
      showPoints: true,
      celebrateMilestones: false,
    });
  });

  it("saves toggles", async () => {
    await saveMotivation(db, TEST_USER_ID, { showPoints: false, celebrateMilestones: true });
    expect(await getUserSettings(db, TEST_USER_ID)).toMatchObject({
      showPoints: false,
      celebrateMilestones: true,
    });
    expect((await getUserSettings(db, OTHER_USER_ID)).showPoints).toBe(true);
  });
});

describe("timezone", () => {
  it("accepts IANA zones and UTC only", () => {
    expect(isSupportedTimezone("Asia/Seoul")).toBe(true);
    expect(isSupportedTimezone("UTC")).toBe(true);
    expect(isSupportedTimezone("Mars/Olympus")).toBe(false);
    expect(timezoneInput.safeParse({ timezone: "Europe/Paris" }).success).toBe(true);
    expect(timezoneInput.safeParse({ timezone: "nope" }).success).toBe(false);
  });

  it("saves the timezone", async () => {
    await saveTimezone(db, TEST_USER_ID, { timezone: "Asia/Seoul" });
    expect((await getUserSettings(db, TEST_USER_ID)).timezone).toBe("Asia/Seoul");
  });
});
