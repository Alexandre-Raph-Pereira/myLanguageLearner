import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activityEvents, languageProfiles, testSessions, userSettings, words } from "@/db/schema";
import type { Db } from "@/db/types";
import { getProgressSummary } from "@/lib/progress/summary";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { wordInput } from "./input";
import { createWord, getWord } from "./queries";
import { seededRng } from "./select";
import {
  answerWord,
  candidateStats,
  getSessionResults,
  getWordSession,
  latestOpenSession,
  NoWordsError,
  overrideAnswer,
  startRetry,
  startWordTest,
  wordTestConfig,
} from "./session";
import "./progress-sources";

const me = { userId: TEST_USER_ID, language: "ko" as const };
const NOW = new Date("2026-11-22T10:00:00Z");
const DAY = 86_400_000;

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
  await db.insert(languageProfiles).values({ userId: TEST_USER_ID, language: "ko" });
});

async function addWord(term: string, meanings: string[], extra: Record<string, unknown> = {}) {
  return createWord(db, me, wordInput.parse({ term, meanings, ...extra }));
}

const config = (over: Record<string, unknown> = {}) => wordTestConfig.parse({ count: 5, ...over });

async function eventsOf(kind: string) {
  return db
    .select()
    .from(activityEvents)
    .where(
      and(eq(activityEvents.userId, TEST_USER_ID), eq(activityEvents.kind, kind as "word_answer")),
    );
}

describe("startWordTest", () => {
  it("creates an in-progress session with selected items and directions", async () => {
    for (let i = 0; i < 8; i++)
      await addWord(`단어${i}`, [`word ${i}`], { type: i < 4 ? "noun" : "verb" });
    const s = await startWordTest(db, me, config({ types: ["noun"] }), {
      now: NOW,
      rng: seededRng(1),
    });
    const state = await getWordSession(db, me, s.id);
    expect(state?.session.status).toBe("in_progress");
    expect(state?.items).toHaveLength(4);
    expect(state?.items.every((i) => i.direction === "en_ko")).toBe(true);

    const mixed = await startWordTest(db, me, config({ direction: "mixed", count: 8 }), {
      now: NOW,
      rng: seededRng(3),
    });
    const dirs = new Set((await getWordSession(db, me, mixed.id))?.items.map((i) => i.direction));
    expect(dirs).toEqual(new Set(["en_ko", "ko_en"]));
    // The first session was abandoned (one resumable test).
    expect((await getWordSession(db, me, s.id))?.session.status).toBe("abandoned");
    expect((await latestOpenSession(db, me))?.id).toBe(mixed.id);
  });

  it("throws when nothing matches", async () => {
    await addWord("사과", ["apple"]);
    await expect(startWordTest(db, me, config({ types: ["verb"] }))).rejects.toBeInstanceOf(
      NoWordsError,
    );
    await expect(startWordTest(db, me, config({ includeNoExample: false }))).rejects.toBeInstanceOf(
      NoWordsError,
    );
  });

  it("validates config bounds", () => {
    expect(wordTestConfig.safeParse({ count: 4 }).success).toBe(false);
    expect(wordTestConfig.safeParse({ count: 51 }).success).toBe(false);
    expect(wordTestConfig.parse({})).toEqual({
      types: [],
      direction: "en_ko",
      count: 25,
      includeNoExample: true,
    });
  });
});

describe("answerWord", () => {
  it("correct → level up + due date; wrong → level 0; points and goal", async () => {
    const a = await addWord("먹다", ["to eat"], {
      exampleSentence: "밥을 먹어요.",
      exampleTranslation: "I eat rice.",
    });
    const b = await addWord("마시다", ["to drink"]);
    await db.update(words).set({ level: 2, intervalDays: 3 }).where(eq(words.id, b.id));
    const s = await startWordTest(db, me, config(), { now: NOW, rng: seededRng(2) });
    const state = (await getWordSession(db, me, s.id))!;
    const ia = state.items.findIndex((i) => i.wordId === a.id);
    const ib = state.items.findIndex((i) => i.wordId === b.id);

    const ok = await answerWord(db, me, { sessionId: s.id, index: ia, answer: "먹 다.", now: NOW });
    expect(ok).toMatchObject({
      result: "correct",
      expected: "먹다",
      levelFrom: 0,
      levelTo: 1,
      intervalDays: 1,
      points: 10,
      becameKnown: false,
      example: { text: "밥을 먹어요.", translation: "I eat rice." },
      goal: { words: 1, goal: 20 },
      done: false,
    });
    const wa = await getWord(db, me, a.id);
    expect(wa?.level).toBe(1);
    expect(wa?.dueAt.getTime()).toBe(NOW.getTime() + DAY);

    const bad = await answerWord(db, me, { sessionId: s.id, index: ib, answer: "먹다", now: NOW });
    expect(bad).toMatchObject({ result: "wrong", levelFrom: 2, levelTo: 0, points: 0, done: true });
    const wb = await getWord(db, me, b.id);
    expect(wb).toMatchObject({ level: 0, timesFailed: 1 });
    expect(wb?.dueAt.getTime()).toBe(NOW.getTime());

    // Idempotent: answering again returns the stored outcome.
    const again = await answerWord(db, me, { sessionId: s.id, index: ia, answer: "x", now: NOW });
    expect(again).toMatchObject({ result: "correct", points: 0 });
    expect(await eventsOf("word_answer")).toHaveLength(2);

    const done = (await getWordSession(db, me, s.id))!;
    expect(done.session).toMatchObject({ status: "finished", scoreCorrect: 1, scoreTotal: 2 });
    expect(done.nextIndex).toBe(2);
  });

  it("alternative keeps the level and awards points", async () => {
    const eat = await addWord("먹다", ["to eat"]);
    await addWord("드시다", ["to eat (honorific)", "eat"]);
    await db.update(words).set({ level: 1 }).where(eq(words.id, eat.id));
    const s = await startWordTest(db, me, config({ count: 5 }), { now: NOW, rng: seededRng(1) });
    const state = (await getWordSession(db, me, s.id))!;
    const i = state.items.findIndex((it) => it.wordId === eat.id);
    const out = await answerWord(db, me, { sessionId: s.id, index: i, answer: "드시다", now: NOW });
    expect(out).toMatchObject({
      result: "alternative",
      alternativeTerm: "드시다",
      levelFrom: 1,
      levelTo: 1,
      points: 10,
    });
    expect((await getWord(db, me, eat.id))?.level).toBe(1);
  });

  it("reaching level 2 awards word_known (+5)", async () => {
    const w = await addWord("물", ["water"]);
    await db.update(words).set({ level: 1, intervalDays: 1 }).where(eq(words.id, w.id));
    const s = await startWordTest(db, me, config(), { now: NOW });
    const out = await answerWord(db, me, { sessionId: s.id, index: 0, answer: "물", now: NOW });
    expect(out).toMatchObject({ levelTo: 2, becameKnown: true, points: 15, intervalDays: 3 });
    expect(await eventsOf("word_known")).toHaveLength(1);
  });

  it("ko_en checks meanings", async () => {
    await addWord("책", ["book"]);
    const s = await startWordTest(db, me, config({ direction: "ko_en" }), { now: NOW });
    const out = await answerWord(db, me, {
      sessionId: s.id,
      index: 0,
      answer: "The Book",
      now: NOW,
    });
    expect(out).toMatchObject({ result: "correct", expected: "book", direction: "ko_en" });
  });
});

describe("overrideAnswer", () => {
  it("turns a wrong answer into override with onCorrect and 10 points", async () => {
    const w = await addWord("책", ["book"]);
    await db.update(words).set({ level: 1, intervalDays: 1 }).where(eq(words.id, w.id));
    const s = await startWordTest(db, me, config({ direction: "ko_en" }), { now: NOW });
    const wrong = await answerWord(db, me, {
      sessionId: s.id,
      index: 0,
      answer: "novel",
      now: NOW,
    });
    expect(wrong.result).toBe("wrong");

    const out = await overrideAnswer(db, me, {
      sessionId: s.id,
      index: 0,
      addMeaning: true,
      now: NOW,
    });
    expect(out).toMatchObject({
      result: "override",
      levelFrom: 1,
      levelTo: 2,
      points: 15,
      becameKnown: true,
    });
    const after = await getWord(db, me, w.id);
    expect(after).toMatchObject({
      level: 2,
      intervalDays: 3,
      timesFailed: 0,
      timesCorrect: 1,
      meanings: ["book", "novel"],
    });
    const [ev] = await eventsOf("word_answer");
    expect(ev.points).toBe(10);
    const [session] = await db.select().from(testSessions).where(eq(testSessions.id, s.id));
    expect(session).toMatchObject({ scoreCorrect: 1, scoreTotal: 1 });

    // A second override is a no-op.
    const twice = await overrideAnswer(db, me, { sessionId: s.id, index: 0, now: NOW });
    expect(twice.points).toBe(0);
    const summary = await getProgressSummary(db, TEST_USER_ID, "ko", NOW);
    expect(summary.points.total).toBe(15);
  });
});

describe("I don't know (empty answer)", () => {
  it("counts as wrong, resets the schedule and cannot be overridden", async () => {
    const w = await addWord("책", ["book"]);
    await db.update(words).set({ level: 2, intervalDays: 3 }).where(eq(words.id, w.id));
    const s = await startWordTest(db, me, config(), { now: NOW });
    const out = await answerWord(db, me, { sessionId: s.id, index: 0, answer: "", now: NOW });
    expect(out).toMatchObject({ result: "wrong", answer: "", expected: "책", levelTo: 0 });

    const again = await overrideAnswer(db, me, { sessionId: s.id, index: 0, now: NOW });
    expect(again).toMatchObject({ result: "wrong", points: 0 });
    expect((await getWord(db, me, w.id))?.level).toBe(0);
  });
});

describe("results + retry", () => {
  it("summarizes the session and retries the missed words", async () => {
    const a = await addWord("하나", ["one"]);
    const b = await addWord("둘", ["two"]);
    const c = await addWord("셋", ["three"]);
    await db.update(words).set({ level: 1 }).where(eq(words.id, c.id));
    const s = await startWordTest(db, me, config(), { now: NOW, rng: seededRng(4) });
    const state = (await getWordSession(db, me, s.id))!;
    for (const [i, item] of state.items.entries()) {
      const answer = item.wordId === b.id ? "틀림" : item.wordId === a.id ? "하나" : "셋";
      await answerWord(db, me, { sessionId: s.id, index: i, answer, now: NOW });
    }
    const final = (await getWordSession(db, me, s.id))!;
    const res = await getSessionResults(db, me, final, NOW);
    expect(res).toMatchObject({ correct: 2, total: 3, pct: 67 });
    expect(res.levelsBefore).toEqual([2, 1, 0, 0]);
    expect(res.levelsAfter).toEqual([1, 1, 1, 0]);
    expect(res.missed.map((m) => m.term)).toEqual(["둘"]);
    expect(res.activity.pointsAdded).toBe(25);
    expect(res.activity.awarded.filter((e) => e.kind === "word_answer")).toHaveLength(3);

    const retry = await startRetry(db, me, s.id, { now: NOW });
    const rs = (await getWordSession(db, me, retry.id))!;
    expect(rs.items.map((i) => i.wordId)).toEqual([b.id]);
    expect(rs.config.retryOf).toBe(s.id);
  });

  it("counts candidates per type and example", async () => {
    await addWord("사과", ["apple"], { type: "noun", exampleSentence: "x" });
    await addWord("배", ["pear"], { type: "noun" });
    const stats = await candidateStats(db, me, NOW);
    expect(stats.reduce((a, r) => a + r.total, 0)).toBe(2);
  });
});
