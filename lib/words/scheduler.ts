/**
 * Level 0–3 shown to the user, time-based schedule behind it (VISION.md → Words).
 * Pure functions: they return the new schedule fields, the caller persists them.
 */

export type Schedule = {
  level: number;
  intervalDays: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  correctStreak: number;
  timesCorrect: number;
  timesFailed: number;
  timesLookedUp: number;
};

/** Days until the next review after reaching level 1 / 2 / 3. */
export const INTERVALS: Record<1 | 2 | 3, number> = { 1: 1, 2: 3, 3: 7 };
export const MAX_INTERVAL_DAYS = 120;
export const MAX_LEVEL = 3;
export const KNOWN_LEVEL = 2;

const DAY_MS = 86_400_000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

/** Next interval (days) for a correct answer given the level before it. */
export function nextInterval(levelBefore: number, intervalBefore: number): number {
  const level = Math.min(levelBefore + 1, MAX_LEVEL) as 1 | 2 | 3;
  if (level < MAX_LEVEL) return INTERVALS[level];
  if (levelBefore >= MAX_LEVEL) {
    return Math.min(Math.max(intervalBefore, INTERVALS[3]) * 2, MAX_INTERVAL_DAYS);
  }
  return INTERVALS[3];
}

export function onCorrect(w: Schedule, now: Date): Schedule {
  const level = Math.min(w.level + 1, MAX_LEVEL);
  const intervalDays = nextInterval(w.level, w.intervalDays);
  return {
    ...w,
    level,
    intervalDays,
    dueAt: addDays(now, intervalDays),
    lastReviewedAt: now,
    correctStreak: w.correctStreak + 1,
    timesCorrect: w.timesCorrect + 1,
  };
}

export function onWrong(w: Schedule, now: Date): Schedule {
  return {
    ...w,
    level: 0,
    intervalDays: 0,
    dueAt: now,
    lastReviewedAt: now,
    correctStreak: 0,
    timesFailed: w.timesFailed + 1,
  };
}

/** Looking a bank word up during a TOPIK test resets it (plan 05). */
export function resetToZero(
  w: Schedule,
  now: Date,
  reason: "lookup" | "manual" = "lookup",
): Schedule {
  return {
    ...w,
    level: 0,
    intervalDays: 0,
    dueAt: now,
    correctStreak: 0,
    timesLookedUp: w.timesLookedUp + (reason === "lookup" ? 1 : 0),
  };
}

export function isKnown(w: { level: number }): boolean {
  return w.level >= KNOWN_LEVEL;
}

/** "in 3 days" / "in 1 day" / "back in today's review". */
export function describeNextReview(intervalDays: number): string {
  if (intervalDays <= 0) return "back in today's review";
  return `in ${intervalDays} ${intervalDays === 1 ? "day" : "days"}`;
}

/** Picks the schedule fields out of a word row. */
export function scheduleOf(w: Schedule): Schedule {
  return {
    level: w.level,
    intervalDays: w.intervalDays,
    dueAt: w.dueAt,
    lastReviewedAt: w.lastReviewedAt,
    correctStreak: w.correctStreak,
    timesCorrect: w.timesCorrect,
    timesFailed: w.timesFailed,
    timesLookedUp: w.timesLookedUp,
  };
}

/** "Due now" or "Next review in N days" for a word's due date. */
export function dueLabel(dueAt: Date, now: Date): string {
  const ms = dueAt.getTime() - now.getTime();
  if (ms <= 0) return "Due now";
  return `Next review ${describeNextReview(Math.ceil(ms / DAY_MS))}`;
}
