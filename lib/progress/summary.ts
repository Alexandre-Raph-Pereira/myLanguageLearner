import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { dailyProgress, milestonesEarned } from "@/db/schema";
import type { Db } from "@/db/types";
import type { Language } from "@/lib/languages";
import { getLanguageProfile, getUserSettings } from "@/lib/settings";
import { addDays, localDate, startOfWeek } from "./days";
import { goalPercent, isGoalMet } from "./goal";
import { evaluate, nextMilestone, type Milestone } from "./milestones";
import { rankFor, type Rank } from "./ranks";
import {
  collectLedger,
  collectSnapshot,
  collectTestScores,
  type LedgerRowData,
  type TestScoreData,
} from "./sources";
import { computeStreak, type Streak } from "./streak";
import "./register-sources";

export type WeekDayStatus = "met" | "missed" | "future" | "today";

export type SummaryDay = {
  date: string;
  status: WeekDayStatus;
  /** Goal % that day (0 when no activity). */
  pct: number;
  points: number;
};

export type ProgressSummary = {
  today: {
    date: string;
    words: number;
    lessons: number;
    goalWords: number;
    goalLessons: number;
    pct: number;
    met: boolean;
    /** Word answers still needed for the goal (0 when reached). */
    wordsLeft: number;
  };
  /** Monday → Sunday of the current local week. */
  week: SummaryDay[];
  streak: Streak;
  points: { total: number; today: number; week: number };
  rank: Rank;
  nextMilestone: { milestone: Milestone; pct: number } | null;
  milestonesEarned: number;
  ledger: LedgerRowData[];
  tests: TestScoreData[];
  settings: { showPoints: boolean; celebrateMilestones: boolean; timezone: string };
  /** No activity ever recorded for this language. */
  isEmpty: boolean;
};

/** Everything Home needs, for one language. Read-only (never inserts). */
export async function getProgressSummary(
  db: Db,
  userId: string,
  language: Language,
  now: Date = new Date(),
): Promise<ProgressSummary> {
  const settings = await getUserSettings(db, userId);
  const profile = await getLanguageProfile(db, userId, language);
  const goalWords = profile?.dailyGoalWords ?? 20;
  const goalLessons = profile?.dailyGoalGrammar ?? 1;
  const pointsTotal = profile?.pointsTotal ?? 0;
  const today = localDate(now, settings.timezone);
  const monday = startOfWeek(today);
  const sunday = addDays(monday, 6);

  const scope = and(eq(dailyProgress.userId, userId), eq(dailyProgress.language, language));
  const weekRows = await db
    .select()
    .from(dailyProgress)
    .where(and(scope, gte(dailyProgress.localDate, monday), lte(dailyProgress.localDate, sunday)));
  const metRows = await db
    .select({ d: dailyProgress.localDate })
    .from(dailyProgress)
    .where(and(scope, eq(dailyProgress.goalMet, true)));
  const [anyDay] = await db
    .select({ d: dailyProgress.localDate })
    .from(dailyProgress)
    .where(scope)
    .limit(1);

  const byDate = new Map(weekRows.map((r) => [r.localDate, r]));
  const todayRow = byDate.get(today);
  const counts = {
    words: todayRow?.wordsAnswered ?? 0,
    lessons: todayRow?.grammarLessons ?? 0,
    goalWords,
    goalLessons,
  };

  const week: SummaryDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const row = byDate.get(date);
    const pct =
      date === today
        ? goalPercent(counts)
        : row
          ? goalPercent({
              words: row.wordsAnswered,
              lessons: row.grammarLessons,
              goalWords: row.goalWords,
              goalLessons: row.goalGrammar,
            })
          : 0;
    const met = row?.goalMet ?? false;
    const status: WeekDayStatus =
      date > today ? "future" : met ? "met" : date === today ? "today" : "missed";
    return { date, status, pct, points: row?.points ?? 0 };
  });

  const computed = computeStreak(
    metRows.map((r) => r.d),
    today,
  );
  const streak = { ...computed, best: Math.max(computed.best, profile?.bestStreak ?? 0) };

  const ctx = { db, userId, language, today };
  const earnedRows = await db
    .select({ id: milestonesEarned.milestoneId })
    .from(milestonesEarned)
    .where(and(eq(milestonesEarned.userId, userId), eq(milestonesEarned.language, language)));
  const evaluation = evaluate(await collectSnapshot(ctx, streak.current));

  return {
    today: {
      date: today,
      ...counts,
      pct: goalPercent(counts),
      met: (todayRow?.goalMet ?? false) || isGoalMet(counts),
      wordsLeft: Math.max(goalWords - counts.words, 0),
    },
    week,
    streak,
    points: {
      total: pointsTotal,
      today: todayRow?.points ?? 0,
      week: week.reduce((a, d) => a + d.points, 0),
    },
    rank: rankFor(pointsTotal),
    nextMilestone: nextMilestone(
      evaluation,
      earnedRows.map((r) => r.id),
    ),
    milestonesEarned: earnedRows.length,
    ledger: await collectLedger(ctx),
    tests: await collectTestScores(ctx),
    settings: {
      showPoints: settings.showPoints,
      celebrateMilestones: settings.celebrateMilestones,
      timezone: settings.timezone,
    },
    isEmpty: !anyDay && pointsTotal === 0,
  };
}
