import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { creditLesson, todayFor } from "./credit";
import { createGrammar, creditedLessonIds } from "./queries";
import { grammarInput } from "./schema";

const me = { userId: TEST_USER_ID, language: "ko" as const };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("creditLesson", () => {
  it("awards 10 points once per lesson per day and counts for the grammar goal", async () => {
    const g = await createGrammar(
      db,
      me,
      grammarInput.parse({
        title: "-아/어서",
        pattern: "-아/어서",
        variants: [],
        meaning_short: "because",
        level: 1,
        examples: [
          { sentence: "가", translation: "a" },
          { sentence: "나", translation: "b" },
        ],
        related: [],
      }),
    );
    const now = new Date("2026-11-23T09:00:00Z");
    const first = await creditLesson(db, me, g.id, "saved", now);
    expect(first.awarded.find((e) => e.kind === "grammar_credit")?.points).toBe(10);
    const again = await creditLesson(db, me, g.id, "studied", now);
    expect(again.awarded).toEqual([]);
    expect(again.pointsAdded).toBe(0);

    const today = await todayFor(db, me.userId, now);
    expect([...(await creditedLessonIds(db, me, today))]).toEqual([g.id]);

    const tomorrow = await creditLesson(db, me, g.id, "studied", new Date("2026-11-24T09:00:00Z"));
    expect(tomorrow.awarded.some((e) => e.kind === "grammar_credit")).toBe(true);
  });
});
