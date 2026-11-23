import "server-only";
import { and, countDistinct, desc, eq, lte, sql } from "drizzle-orm";
import { activityEvents } from "@/db/schema/progress";
import { testSessions, words } from "@/db/schema/words";
import {
  registerLedgerSource,
  registerSnapshotSource,
  registerTestScoreSource,
} from "@/lib/progress/sources";
import { wordStats } from "./queries";

/**
 * Plan 01 progress sources (plan 00c registry):
 * - snapshot `wordsKnown` (level ≥ 2) for the words-known milestones,
 * - ledger rows "Words known" (known / total) and "Due today",
 * - Home test tile `lastScore.word`.
 */

registerSnapshotSource("wordsKnown", async ({ db, userId, language }) => {
  const stats = await wordStats(db, { userId, language });
  return stats.known;
});

registerLedgerSource("words-known", 10, async ({ db, userId, language }) => {
  const stats = await wordStats(db, { userId, language });
  if (stats.total === 0) return null;
  return {
    id: "words-known",
    name: "Words known",
    sub: `${stats.known.toLocaleString("en-US")} / ${stats.total.toLocaleString("en-US")}`,
    pct: (stats.known / stats.total) * 100,
  };
});

registerLedgerSource("words-due", 40, async ({ db, userId, language, today }) => {
  const stats = await wordStats(db, { userId, language });
  if (stats.total === 0) return null;
  const [{ answered, stillDue }] = await db
    .select({
      answered: countDistinct(activityEvents.refId),
      stillDue: sql<number>`count(distinct ${words.id})`.mapWith(Number),
    })
    .from(activityEvents)
    .leftJoin(
      words,
      and(
        eq(words.id, activityEvents.refId),
        eq(words.userId, userId),
        lte(words.dueAt, new Date()),
      ),
    )
    .where(
      and(
        eq(activityEvents.userId, userId),
        eq(activityEvents.language, language),
        eq(activityEvents.kind, "word_answer"),
        eq(activityEvents.localDate, today),
      ),
    );
  // Due at the start of the day ≈ words reviewed today + words due now that were not
  // reviewed today (a failed word is due again but was already counted).
  const dueAtStart = answered + stats.due - stillDue;
  return {
    id: "words-due",
    name: "Due today",
    sub: `${answered} answered today / ${dueAtStart} due at start of day`,
    pct: null,
    count: stats.due,
  };
});

registerTestScoreSource("words", async ({ db, userId, language }) => {
  const [last] = await db
    .select({ correct: testSessions.scoreCorrect, total: testSessions.scoreTotal })
    .from(testSessions)
    .where(
      and(
        eq(testSessions.userId, userId),
        eq(testSessions.language, language),
        eq(testSessions.kind, "word"),
        eq(testSessions.status, "finished"),
      ),
    )
    .orderBy(desc(testSessions.finishedAt))
    .limit(1);
  if (!last || last.total === 0) return null;
  return {
    testId: "words",
    lastScore: (last.correct / last.total) * 100,
    sub: `Last score · ${last.correct} / ${last.total}`,
  };
});
