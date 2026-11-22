import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityEvents,
  dailyProgress,
  languageProfiles,
  milestonesEarned,
  userSettings,
} from "@/db/schema";
import type { Db } from "@/db/types";
import { createTestDb } from "@/tests/db";
import { adjustActivity, recordActivity, type ActivityInput } from "./record";
import {
  registerLedgerSource,
  registerSnapshotSource,
  registerTestScoreSource,
  resetSources,
} from "./sources";
import { getProgressSummary } from "./summary";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
afterEach(() => resetSources());

const NOW = new Date("2026-11-22T10:00:00Z");
const correct = (n: number, prefix = "r"): ActivityInput[] =>
  Array.from({ length: n }, (_, i) => ({
    kind: "word_answer",
    meta: { correct: true },
    dedupe_key: `word_answer:${prefix}-${i}`,
  }));

async function newUser(opts: { goalWords?: number; goalGrammar?: number; tz?: string } = {}) {
  const userId = randomUUID();
  await db.insert(userSettings).values({ userId, timezone: opts.tz ?? "UTC" });
  await db.insert(languageProfiles).values({
    userId,
    language: "ko",
    dailyGoalWords: opts.goalWords ?? 20,
    dailyGoalGrammar: opts.goalGrammar ?? 1,
  });
  return userId;
}

async function profile(userId: string) {
  const [p] = await db.select().from(languageProfiles).where(eq(languageProfiles.userId, userId));
  return p;
}

describe("recordActivity", () => {
  it("awards points, counts words and updates caches", async () => {
    const userId = await newUser();
    const r = await recordActivity(db, {
      userId,
      language: "ko",
      now: NOW,
      events: [
        ...correct(2),
        { kind: "word_answer", meta: { correct: false }, dedupe_key: "word_answer:wrong" },
        { kind: "word_known", ref_id: randomUUID() },
      ],
    });
    expect(r.pointsAdded).toBe(25);
    expect(r.goal).toEqual({ pct: (3 / 20) * 50, met: false, justMet: false });
    expect(r.localDate).toBe("2026-11-22");
    expect(r.awarded).toHaveLength(4);
    expect((await profile(userId)).pointsTotal).toBe(25);
    const [day] = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));
    expect(day).toMatchObject({ wordsAnswered: 3, points: 25, goalWords: 20, goalGrammar: 1 });
  });

  it("is idempotent: the same dedupe_key twice is counted once", async () => {
    const userId = await newUser();
    const events = correct(3);
    await recordActivity(db, { userId, language: "ko", now: NOW, events });
    const again = await recordActivity(db, { userId, language: "ko", now: NOW, events });
    expect(again.pointsAdded).toBe(0);
    expect(again.awarded).toEqual([]);
    // duplicate inside one batch too
    await recordActivity(db, {
      userId,
      language: "ko",
      now: NOW,
      events: [...correct(1, "dup"), ...correct(1, "dup")],
    });
    const [day] = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));
    expect(day.wordsAnswered).toBe(4);
    expect((await profile(userId)).pointsTotal).toBe(40);
  });

  it("meets the goal exactly once per day (+25 once)", async () => {
    const userId = await newUser({ goalWords: 5, goalGrammar: 1 });
    await recordActivity(db, { userId, language: "ko", now: NOW, events: correct(5) });
    const r = await recordActivity(db, {
      userId,
      language: "ko",
      now: NOW,
      events: [{ kind: "grammar_credit", dedupe_key: "grammar_credit:l1:2026-11-22" }],
    });
    expect(r.goal).toEqual({ pct: 100, met: true, justMet: true });
    expect(r.pointsAdded).toBe(10 + 25);
    expect(r.awarded.map((e) => e.kind)).toEqual(["grammar_credit", "goal_met"]);
    expect(r.streak).toEqual({ current: 1, best: 1, todayMet: true });

    const later = await recordActivity(db, {
      userId,
      language: "ko",
      now: NOW,
      events: correct(2, "more"),
    });
    expect(later.goal).toMatchObject({ met: true, justMet: false });
    expect(later.pointsAdded).toBe(20);
    const goalEvents = await db
      .select()
      .from(activityEvents)
      .where(and(eq(activityEvents.userId, userId), eq(activityEvents.kind, "goal_met")));
    expect(goalEvents).toHaveLength(1);
    expect((await profile(userId)).pointsTotal).toBe(50 + 10 + 25 + 20);
    const [day] = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));
    expect(day.goalMet).toBe(true);
    expect(day.goalMetAt).toEqual(NOW);
  });

  it("grammar goal 0 → words alone meet the goal", async () => {
    const userId = await newUser({ goalWords: 5, goalGrammar: 0 });
    const r = await recordActivity(db, { userId, language: "ko", now: NOW, events: correct(5) });
    expect(r.goal.justMet).toBe(true);
  });

  it("updates the streak across days and keeps best_streak", async () => {
    const userId = await newUser({ goalWords: 5, goalGrammar: 0 });
    const day = (d: string) => new Date(`${d}T12:00:00Z`);
    for (const d of ["2026-11-19", "2026-11-20", "2026-11-21"]) {
      await recordActivity(db, { userId, language: "ko", now: day(d), events: correct(5, d) });
    }
    expect((await profile(userId)).bestStreak).toBe(3);
    // 22nd: nothing yet — streak still 3
    const r22 = await recordActivity(db, {
      userId,
      language: "ko",
      now: day("2026-11-22"),
      events: [],
    });
    expect(r22.streak).toEqual({ current: 3, best: 3, todayMet: false });
    // 24th: the 22nd and 23rd were missed — streak restarts
    const r24 = await recordActivity(db, {
      userId,
      language: "ko",
      now: day("2026-11-24"),
      events: correct(5, "24"),
    });
    expect(r24.streak).toEqual({ current: 1, best: 3, todayMet: true });
    expect((await profile(userId)).bestStreak).toBe(3);
  });

  it("uses the user's timezone for the local day", async () => {
    const userId = await newUser({ tz: "Asia/Seoul" });
    const r = await recordActivity(db, {
      userId,
      language: "ko",
      now: new Date("2026-11-22T15:30:00Z"), // 00:30 on the 23rd in Seoul
      events: correct(1),
    });
    expect(r.localDate).toBe("2026-11-23");
  });

  it("earns a milestone once and records a 0-point milestone event", async () => {
    const userId = await newUser();
    let known = 49;
    registerSnapshotSource("wordsKnown", async () => known);
    const r1 = await recordActivity(db, { userId, language: "ko", now: NOW, events: [] });
    expect(r1.newMilestones).toEqual([]);
    known = 50;
    const r2 = await recordActivity(db, { userId, language: "ko", now: NOW, events: [] });
    expect(r2.newMilestones.map((m) => m.id)).toEqual(["words-50"]);
    expect(r2.awarded).toEqual([
      expect.objectContaining({ kind: "milestone", points: 0, meta: { milestoneId: "words-50" } }),
    ]);
    const r3 = await recordActivity(db, { userId, language: "ko", now: NOW, events: [] });
    expect(r3.newMilestones).toEqual([]);
    const rows = await db
      .select()
      .from(milestonesEarned)
      .where(eq(milestonesEarned.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it("creates the language profile when missing", async () => {
    const userId = randomUUID();
    const r = await recordActivity(db, { userId, language: "ko", now: NOW, events: correct(1) });
    expect(r.rank.name).toBe("Novice");
    expect((await profile(userId)).pointsTotal).toBe(10);
  });

  it("explicit points override the table", async () => {
    const userId = await newUser();
    const r = await recordActivity(db, {
      userId,
      language: "ko",
      now: NOW,
      events: [{ kind: "word_answer", points: 7 }],
    });
    expect(r.pointsAdded).toBe(7);
  });
});

describe("adjustActivity", () => {
  it("'I was right' then undo updates the event and the caches", async () => {
    const userId = await newUser();
    await recordActivity(db, {
      userId,
      language: "ko",
      now: NOW,
      events: [{ kind: "word_answer", meta: { correct: false }, dedupe_key: "word_answer:x" }],
    });
    const up = await adjustActivity(db, {
      userId,
      dedupe_key: "word_answer:x",
      points: 10,
      meta: { correct: true, overridden: true },
    });
    expect(up?.delta).toBe(10);
    expect((await profile(userId)).pointsTotal).toBe(10);
    const [ev] = await db.select().from(activityEvents).where(eq(activityEvents.userId, userId));
    expect(ev.meta).toMatchObject({ correct: true, overridden: true });
    const [day] = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));
    expect(day.points).toBe(10);

    const undo = await adjustActivity(db, { userId, dedupe_key: "word_answer:x", points: 0 });
    expect(undo?.delta).toBe(-10);
    expect((await profile(userId)).pointsTotal).toBe(0);
  });

  it("returns null for an unknown key and never touches other users", async () => {
    const a = await newUser();
    const b = await newUser();
    await recordActivity(db, { userId: a, language: "ko", now: NOW, events: correct(1, "shared") });
    expect(
      await adjustActivity(db, { userId: b, dedupe_key: "word_answer:shared-0", points: 0 }),
    ).toBeNull();
    expect((await profile(a)).pointsTotal).toBe(10);
  });
});

describe("getProgressSummary", () => {
  it("empty user: all zeros, no crash", async () => {
    const s = await getProgressSummary(db, randomUUID(), "ko", NOW);
    expect(s.isEmpty).toBe(true);
    expect(s.today).toEqual({
      date: "2026-11-22",
      words: 0,
      lessons: 0,
      goalWords: 20,
      goalLessons: 1,
      pct: 0,
      met: false,
      wordsLeft: 20,
    });
    expect(s.week).toHaveLength(7);
    expect(s.week[0].date).toBe("2026-11-16");
    expect(s.week[6]).toMatchObject({ date: "2026-11-22", status: "today", pct: 0 });
    expect(s.streak).toEqual({ current: 0, best: 0, todayMet: false });
    expect(s.points).toEqual({ total: 0, today: 0, week: 0 });
    expect(s.rank.name).toBe("Novice");
    expect(s.nextMilestone?.milestone.id).toBe("streak-7");
    expect(s.ledger).toEqual([]);
    expect(s.tests).toEqual([]);
  });

  it("week strip, points and streak after activity", async () => {
    const userId = await newUser({ goalWords: 5, goalGrammar: 0 });
    const at = (d: string) => new Date(`${d}T12:00:00Z`);
    await recordActivity(db, {
      userId,
      language: "ko",
      now: at("2026-11-16"),
      events: correct(5, "a"),
    });
    await recordActivity(db, {
      userId,
      language: "ko",
      now: at("2026-11-17"),
      events: correct(2, "b"),
    });
    await recordActivity(db, {
      userId,
      language: "ko",
      now: at("2026-11-21"),
      events: correct(5, "c"),
    });
    await recordActivity(db, {
      userId,
      language: "ko",
      now: at("2026-11-22"),
      events: correct(3, "d"),
    });

    const s = await getProgressSummary(db, userId, "ko", at("2026-11-22"));
    expect(s.isEmpty).toBe(false);
    expect(s.week.map((d) => d.status)).toEqual([
      "met",
      "missed",
      "missed",
      "missed",
      "missed",
      "met",
      "today",
    ]);
    expect(s.week[1].pct).toBe(70); // 2/5 words, grammar half met
    expect(s.today).toMatchObject({ words: 3, pct: 80, wordsLeft: 2, met: false });
    expect(s.streak).toEqual({ current: 1, best: 1, todayMet: false });
    expect(s.points).toEqual({ total: 75 + 20 + 75 + 30, today: 30, week: 200 });
  });

  it("goal changes apply to today immediately", async () => {
    const userId = await newUser({ goalWords: 20 });
    await recordActivity(db, { userId, language: "ko", now: NOW, events: correct(5) });
    await db
      .update(languageProfiles)
      .set({ dailyGoalWords: 10 })
      .where(eq(languageProfiles.userId, userId));
    const s = await getProgressSummary(db, userId, "ko", NOW);
    expect(s.today.pct).toBe(25);
  });

  it("ledger and test tiles come only from registered sources, in order", async () => {
    const userId = await newUser();
    registerLedgerSource("due", 40, async () => ({
      id: "due",
      name: "Due today",
      pct: null,
      count: 12,
    }));
    registerLedgerSource("words", 10, async () => ({ id: "words", name: "Words known", pct: 42 }));
    registerLedgerSource("coverage", 30, async () => null);
    registerTestScoreSource("words", async () => ({ testId: "words", lastScore: 80 }));
    registerSnapshotSource("wordsKnown", async () => 30);
    const s = await getProgressSummary(db, userId, "ko", NOW);
    expect(s.ledger.map((r) => r.id)).toEqual(["words", "due"]);
    expect(s.tests).toEqual([{ testId: "words", lastScore: 80 }]);
    expect(s.nextMilestone).toEqual({
      milestone: expect.objectContaining({ id: "words-50" }),
      pct: 60,
    });
  });
});
