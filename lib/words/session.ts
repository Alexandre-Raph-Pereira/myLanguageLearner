import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { activityEvents } from "@/db/schema/progress";
import {
  testSessions,
  wordReviews,
  WORD_TYPES,
  words,
  type Direction,
  type ReviewResult,
  type StoredSchedule,
  type TestSession,
  type Word,
  type WordReview,
  type WordType,
} from "@/db/schema/words";
import type { Db } from "@/db/types";
import {
  adjustActivity,
  recordActivity,
  type ActivityInput,
  type ActivityResult,
} from "@/lib/progress/record";
import { MILESTONES_BY_ID, type Milestone } from "@/lib/progress/milestones";
import { getProgressSummary } from "@/lib/progress/summary";
import { normEn } from "@/lib/text/normalize";
import { checkAnswer } from "./answer";
import { getWordsByIds, libraryIndex, patchSchedule, testCandidates, type Scope } from "./queries";
import { KNOWN_LEVEL, onCorrect, onWrong, scheduleOf, type Schedule } from "./scheduler";
import { selectWords, type Rng } from "./select";
import { todayWordGoal } from "./today";

// ---------- config ----------

export const DIRECTION_MODES = ["en_ko", "ko_en", "mixed"] as const;
export type DirectionMode = (typeof DIRECTION_MODES)[number];

export const wordTestConfig = z.object({
  types: z.array(z.enum(WORD_TYPES)).default([]),
  direction: z.enum(DIRECTION_MODES).default("en_ko"),
  count: z.coerce.number().int().min(5).max(50).default(25),
  includeNoExample: z.boolean().default(true),
});
export type WordTestConfig = z.infer<typeof wordTestConfig>;

export type SessionItem = { wordId: string; direction: Direction };
export type WordSessionConfig = WordTestConfig & { items: SessionItem[]; retryOf?: string };

export class NoWordsError extends Error {
  constructor() {
    super("No words match these settings.");
    this.name = "NoWordsError";
  }
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

function directionFor(mode: DirectionMode, rng: Rng): Direction {
  if (mode === "mixed") return rng() < 0.5 ? "en_ko" : "ko_en";
  return mode;
}

const sessionScope = (s: Scope) =>
  and(
    eq(testSessions.userId, s.userId),
    eq(testSessions.language, s.language),
    eq(testSessions.kind, "word"),
  );

/** Older unfinished word sessions are abandoned when a new one starts (one resumable test). */
async function abandonOpenSessions(db: Db, s: Scope) {
  await db
    .update(testSessions)
    .set({ status: "abandoned" })
    .where(and(sessionScope(s), inArray(testSessions.status, ["ready", "in_progress"])));
}

async function insertSession(
  db: Db,
  s: Scope,
  config: WordSessionConfig,
  now: Date,
): Promise<TestSession> {
  await abandonOpenSessions(db, s);
  const [row] = await db
    .insert(testSessions)
    .values({
      userId: s.userId,
      language: s.language,
      kind: "word",
      config,
      status: "in_progress",
      startedAt: now,
    })
    .returning();
  return row;
}

/** Selects words (weighted by level among due words) and creates the session. */
export async function startWordTest(
  db: Db,
  s: Scope,
  config: WordTestConfig,
  opts: { now?: Date; rng?: Rng } = {},
): Promise<TestSession> {
  const now = opts.now ?? new Date();
  const rng = opts.rng ?? Math.random;
  const candidates = await testCandidates(db, s, {
    types: config.types,
    includeNoExample: config.includeNoExample,
  });
  const picked = selectWords(candidates, { count: config.count, now, rng });
  if (picked.length === 0) throw new NoWordsError();
  const items = picked.map((w) => ({
    wordId: w.id,
    direction: directionFor(config.direction, rng),
  }));
  return insertSession(db, s, { ...config, items }, now);
}

/** New session with the words missed in `sessionId` (same directions). */
export async function startRetry(
  db: Db,
  s: Scope,
  sessionId: string,
  opts: { now?: Date } = {},
): Promise<TestSession> {
  const state = await getWordSession(db, s, sessionId);
  if (!state) throw new SessionError("Session not found.");
  const missed = state.items.filter((it) => state.reviews.get(it.wordId)?.result === "wrong");
  if (missed.length === 0) throw new NoWordsError();
  const config: WordSessionConfig = {
    ...state.config,
    count: missed.length,
    items: missed.map(({ wordId, direction }) => ({ wordId, direction })),
    retryOf: sessionId,
  };
  return insertSession(db, s, config, opts.now ?? new Date());
}

// ---------- reading ----------

export type WordSessionState = {
  session: TestSession;
  config: WordSessionConfig;
  items: SessionItem[];
  /** Review per word id (each word appears once per session). */
  reviews: Map<string, WordReview>;
  /** Index of the first unanswered item (= items.length when all answered). */
  nextIndex: number;
};

export async function getWordSession(
  db: Db,
  s: Scope,
  id: string,
): Promise<WordSessionState | null> {
  const [session] = await db
    .select()
    .from(testSessions)
    .where(and(sessionScope(s), eq(testSessions.id, id)));
  if (!session) return null;
  const config = session.config as WordSessionConfig;
  const items = config.items ?? [];
  const rows = await db
    .select()
    .from(wordReviews)
    .where(and(eq(wordReviews.userId, s.userId), eq(wordReviews.sessionId, id)))
    .orderBy(asc(wordReviews.createdAt));
  const reviews = new Map(rows.map((r) => [r.wordId, r]));
  const firstOpen = items.findIndex((it) => !reviews.has(it.wordId));
  return {
    session,
    config,
    items,
    reviews,
    nextIndex: firstOpen === -1 ? items.length : firstOpen,
  };
}

/** Most recent unfinished word session (resume card on Home / Tests). */
export async function latestOpenSession(
  db: Db,
  s: Scope,
): Promise<{ id: string; answered: number; total: number } | null> {
  const [row] = await db
    .select()
    .from(testSessions)
    .where(and(sessionScope(s), eq(testSessions.status, "in_progress")))
    .orderBy(desc(testSessions.startedAt))
    .limit(1);
  if (!row) return null;
  const total = ((row.config as WordSessionConfig).items ?? []).length;
  return { id: row.id, answered: row.scoreTotal, total };
}

// ---------- answering ----------

const toStored = (w: Schedule): StoredSchedule => ({
  ...w,
  dueAt: w.dueAt.toISOString(),
  lastReviewedAt: w.lastReviewedAt?.toISOString() ?? null,
});
const fromStored = (w: StoredSchedule): Schedule => ({
  ...w,
  dueAt: new Date(w.dueAt),
  lastReviewedAt: w.lastReviewedAt ? new Date(w.lastReviewedAt) : null,
});

export type AnswerOutcome = {
  index: number;
  result: ReviewResult;
  direction: Direction;
  /** The expected answer: the term (en_ko) or the meanings (ko_en). */
  expected: string;
  answer: string;
  /** Term of the bank word accepted as an alternative. */
  alternativeTerm?: string;
  levelFrom: number;
  levelTo: number;
  intervalDays: number;
  /** Points of the answer (+ known bonus). */
  points: number;
  becameKnown: boolean;
  example: { text: string; translation?: string } | null;
  goal: { words: number; goal: number };
  done: boolean;
};

function expectedFor(word: Word, direction: Direction): string {
  return direction === "en_ko" ? word.term : word.meanings.join(", ");
}

function exampleOf(word: Word): AnswerOutcome["example"] {
  return word.exampleSentence
    ? { text: word.exampleSentence, translation: word.exampleTranslation ?? undefined }
    : null;
}

async function todayGoal(db: Db, s: Scope, now: Date) {
  const { words: done, goal } = await todayWordGoal(db, s, now);
  return { words: done, goal };
}

function outcomeFrom(
  review: WordReview,
  word: Word,
  index: number,
  points: number,
  goal: { words: number; goal: number },
  done: boolean,
  alternativeTerm?: string,
): AnswerOutcome {
  return {
    index,
    result: review.result,
    direction: review.direction,
    expected: expectedFor(word, review.direction),
    answer: review.answer,
    alternativeTerm,
    levelFrom: review.levelBefore,
    levelTo: review.levelAfter,
    intervalDays: word.intervalDays,
    points,
    becameKnown: review.levelBefore < KNOWN_LEVEL && review.levelAfter >= KNOWN_LEVEL,
    example: exampleOf(word),
    goal,
    done,
  };
}

async function updateScore(
  db: Db,
  sessionId: string,
  total: number,
  correct: number,
  done: boolean,
  now: Date,
) {
  await db
    .update(testSessions)
    .set({
      scoreTotal: sql`${testSessions.scoreTotal} + ${total}`,
      scoreCorrect: sql`${testSessions.scoreCorrect} + ${correct}`,
      ...(done ? { status: "finished" as const, finishedAt: now } : {}),
    })
    .where(eq(testSessions.id, sessionId));
}

/**
 * Checks one answer, stores the review, applies the scheduler and awards progress.
 * Answering an item twice returns the stored outcome (no double counting).
 */
export async function answerWord(
  db: Db,
  s: Scope,
  input: { sessionId: string; index: number; answer: string; now?: Date },
): Promise<AnswerOutcome> {
  const now = input.now ?? new Date();
  const state = await getWordSession(db, s, input.sessionId);
  if (!state) throw new SessionError("Session not found.");
  if (state.session.status === "abandoned")
    throw new SessionError("This test was replaced by a newer one.");
  const item = state.items[input.index];
  if (!item) throw new SessionError("No such question.");
  const [word] = await getWordsByIds(db, s, [item.wordId]);
  if (!word) throw new SessionError("This word was deleted.");

  const existing = state.reviews.get(item.wordId);
  if (existing) {
    const goal = await todayGoal(db, s, now);
    return outcomeFrom(existing, word, input.index, 0, goal, state.nextIndex >= state.items.length);
  }

  const answer = input.answer.normalize("NFC").trim().slice(0, 500);
  const bank = item.direction === "en_ko" ? await libraryIndex(db, s) : [];
  const check = checkAnswer({
    word,
    direction: item.direction,
    answer,
    bank,
    language: s.language,
  });
  const before = scheduleOf(word);
  const after =
    check.result === "correct"
      ? onCorrect(before, now)
      : check.result === "wrong"
        ? onWrong(before, now)
        : before;
  const updated =
    check.result === "alternative" ? word : ((await patchSchedule(db, s, word.id, after)) ?? word);

  const [review] = await db
    .insert(wordReviews)
    .values({
      userId: s.userId,
      sessionId: input.sessionId,
      wordId: word.id,
      direction: item.direction,
      answer,
      result: check.result,
      levelBefore: before.level,
      levelAfter: after.level,
      prevSchedule: toStored(before),
      createdAt: now,
    })
    .returning();

  const done = state.items.every((it, i) => i === input.index || state.reviews.has(it.wordId));
  const right = check.result !== "wrong";
  await updateScore(db, input.sessionId, 1, right ? 1 : 0, done, now);

  const events: ActivityInput[] = [
    {
      kind: "word_answer",
      ref_id: word.id,
      session_id: input.sessionId,
      dedupe_key: `word_answer:${review.id}`,
      meta: { correct: right, result: check.result, direction: item.direction },
    },
  ];
  if (before.level < KNOWN_LEVEL && after.level >= KNOWN_LEVEL) {
    events.push({
      kind: "word_known",
      ref_id: word.id,
      session_id: input.sessionId,
      dedupe_key: `word_known:${word.id}:${review.id}`,
    });
  }
  const activity = await recordActivity(db, {
    userId: s.userId,
    language: s.language,
    events,
    now,
  });
  const points = activity.awarded
    .filter((e) => e.kind === "word_answer" || e.kind === "word_known")
    .reduce((a, e) => a + e.points, 0);

  const alternativeTerm = check.alternativeId
    ? bank.find((b) => b.id === check.alternativeId)?.term
    : undefined;
  return outcomeFrom(
    review,
    updated,
    input.index,
    points,
    await todayGoal(db, s, now),
    done,
    alternativeTerm,
  );
}

/**
 * "I was right": a wrong answer becomes `override` — onCorrect is applied to the schedule
 * from before the answer, the answer's points become 10. For `ko_en` the answer can be
 * added as an accepted meaning.
 */
export async function overrideAnswer(
  db: Db,
  s: Scope,
  input: { sessionId: string; index: number; addMeaning?: boolean; now?: Date },
): Promise<AnswerOutcome> {
  const now = input.now ?? new Date();
  const state = await getWordSession(db, s, input.sessionId);
  if (!state) throw new SessionError("Session not found.");
  const item = state.items[input.index];
  if (!item) throw new SessionError("No such question.");
  const review = state.reviews.get(item.wordId);
  if (!review) throw new SessionError("Answer this question first.");
  const [word] = await getWordsByIds(db, s, [item.wordId]);
  if (!word) throw new SessionError("This word was deleted.");
  const done = state.nextIndex >= state.items.length;
  // Nothing to accept for "I don't know" (empty answer).
  if (review.result !== "wrong" || !review.answer) {
    return outcomeFrom(review, word, input.index, 0, await todayGoal(db, s, now), done);
  }

  const before = review.prevSchedule ? fromStored(review.prevSchedule) : scheduleOf(word);
  // `before` is the schedule from before the wrong answer, so its failure is undone too.
  const after = onCorrect(before, now);
  const patch: Parameters<typeof patchSchedule>[3] = { ...after };
  if (input.addMeaning && item.direction === "ko_en" && review.answer) {
    const key = normEn(review.answer);
    if (key && !word.meanings.some((m) => normEn(m) === key)) {
      patch.meanings = [...word.meanings, review.answer];
    }
  }
  const updated = (await patchSchedule(db, s, word.id, patch)) ?? word;
  const [changed] = await db
    .update(wordReviews)
    .set({ result: "override", levelAfter: after.level })
    .where(and(eq(wordReviews.id, review.id), eq(wordReviews.userId, s.userId)))
    .returning();
  await updateScore(db, input.sessionId, 0, 1, false, now);

  const adjusted = await adjustActivity(db, {
    userId: s.userId,
    dedupe_key: `word_answer:${review.id}`,
    points: 10,
    meta: { correct: true, result: "override" },
  });
  let points = adjusted ? adjusted.delta : 0;
  if (before.level < KNOWN_LEVEL && after.level >= KNOWN_LEVEL) {
    const activity = await recordActivity(db, {
      userId: s.userId,
      language: s.language,
      now,
      events: [
        {
          kind: "word_known",
          ref_id: word.id,
          session_id: input.sessionId,
          dedupe_key: `word_known:${word.id}:${review.id}`,
        },
      ],
    });
    points += activity.awarded
      .filter((e) => e.kind === "word_known")
      .reduce((a, e) => a + e.points, 0);
  }
  return outcomeFrom(changed, updated, input.index, points, await todayGoal(db, s, now), done);
}

// ---------- results ----------

export type MissedWord = {
  id: string;
  term: string;
  meanings: string[];
  direction: Direction;
  answer: string;
};

export type WordSessionResults = {
  correct: number;
  total: number;
  pct: number;
  levelsBefore: [number, number, number, number];
  levelsAfter: [number, number, number, number];
  missed: MissedWord[];
  activity: ActivityResult;
};

/** Session score, level movement, missed words and the session's progress (read-only). */
export async function getSessionResults(
  db: Db,
  s: Scope,
  state: WordSessionState,
  now = new Date(),
): Promise<WordSessionResults> {
  const reviews = [...state.reviews.values()];
  const total = reviews.length;
  const correct = reviews.filter((r) => r.result !== "wrong").length;
  const levelsBefore: [number, number, number, number] = [0, 0, 0, 0];
  const levelsAfter: [number, number, number, number] = [0, 0, 0, 0];
  for (const r of reviews) {
    levelsBefore[Math.min(Math.max(r.levelBefore, 0), 3)]++;
    levelsAfter[Math.min(Math.max(r.levelAfter, 0), 3)]++;
  }
  const missedReviews = reviews.filter((r) => r.result === "wrong");
  const missedWords = await getWordsByIds(
    db,
    s,
    missedReviews.map((r) => r.wordId),
  );
  const byId = new Map(missedWords.map((w) => [w.id, w]));
  const missed = missedReviews.flatMap((r) => {
    const w = byId.get(r.wordId);
    return w
      ? [{ id: w.id, term: w.term, meanings: w.meanings, direction: r.direction, answer: r.answer }]
      : [];
  });

  // Session events + goal / milestone events that happened while the session ran.
  const start = state.session.startedAt;
  const end = state.session.finishedAt ?? now;
  const events = await db
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.userId, s.userId),
        eq(activityEvents.language, s.language),
        or(
          eq(activityEvents.sessionId, state.session.id),
          and(
            inArray(activityEvents.kind, ["goal_met", "milestone"]),
            gte(activityEvents.createdAt, start),
            lte(activityEvents.createdAt, end),
          ),
        ),
      ),
    )
    .orderBy(asc(activityEvents.createdAt));
  const summary = await getProgressSummary(db, s.userId, s.language, now);
  const newMilestones: Milestone[] = events.flatMap((e) => {
    const m = e.kind === "milestone" ? MILESTONES_BY_ID.get(String(e.meta.milestoneId)) : undefined;
    return m ? [m] : [];
  });
  const activity: ActivityResult = {
    pointsAdded: events.reduce((a, e) => a + e.points, 0),
    goal: {
      pct: summary.today.pct,
      met: summary.today.met,
      justMet: events.some((e) => e.kind === "goal_met"),
    },
    streak: summary.streak,
    newMilestones,
    rank: summary.rank,
    pointsTotal: summary.points.total,
    awarded: events.map((e) => ({ kind: e.kind, points: e.points, refId: e.refId, meta: e.meta })),
    localDate: summary.today.date,
  };
  return {
    correct,
    total,
    pct: total ? Math.round((correct / total) * 100) : 0,
    levelsBefore,
    levelsAfter,
    missed,
    activity,
  };
}

/** Per-type candidate counts for the params page ("N due / M total matching"). */
export async function candidateStats(
  db: Db,
  s: Scope,
  now = new Date(),
): Promise<{ type: WordType; hasExample: boolean; total: number; due: number }[]> {
  const rows = await db
    .select({
      type: words.type,
      hasExample: sql<boolean>`${words.exampleSentence} is not null`,
      total: sql<number>`count(*)`.mapWith(Number),
      due: sql<number>`count(*) filter (where ${words.dueAt} <= ${now.toISOString()}::timestamptz)`.mapWith(
        Number,
      ),
    })
    .from(words)
    .where(
      and(eq(words.userId, s.userId), eq(words.language, s.language), eq(words.status, "active")),
    )
    .groupBy(words.type, sql`${words.exampleSentence} is not null`);
  return rows;
}
