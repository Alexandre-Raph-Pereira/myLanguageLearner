/* Dev seed of 30 days of activity (plan 00c T7). Goes through recordActivity like the app. */
import type { Db } from "@/db/types";
import type { Language } from "@/lib/languages";
import { addDays, localDate } from "@/lib/progress/days";
import { recordActivity, type ActivityInput } from "@/lib/progress/record";
import { getUserSettings } from "@/lib/settings";

/** Days before today (1 = yesterday) with the goal missed. Day 13 breaks the streak → 12. */
export const SEED_MISSED_DAYS = [13, 17, 21, 25, 28];
export const SEED_DAYS = 30;

type SeedDay = { offset: number; answers: number; correct: number; known: number; lesson: boolean };

/** Deterministic plan: met days 72 answers (70 correct) + 3 known + 1 lesson; missed days 16 (12 correct); today 14 (12 correct) + 1 lesson. */
export function seedPlan(): SeedDay[] {
  const days: SeedDay[] = [];
  for (let offset = SEED_DAYS - 1; offset >= 1; offset--) {
    days.push(
      SEED_MISSED_DAYS.includes(offset)
        ? { offset, answers: 16, correct: 12, known: 0, lesson: false }
        : { offset, answers: 72, correct: 70, known: 3, lesson: true },
    );
  }
  days.push({ offset: 0, answers: 14, correct: 12, known: 0, lesson: true });
  return days;
}

function eventsFor(day: SeedDay, date: string): ActivityInput[] {
  const events: ActivityInput[] = [];
  for (let i = 0; i < day.answers; i++) {
    events.push({
      kind: "word_answer",
      meta: { correct: i < day.correct, seed: true },
      dedupe_key: `seed:word_answer:${date}:${i}`,
    });
  }
  for (let i = 0; i < day.known; i++) {
    events.push({
      kind: "word_known",
      meta: { seed: true },
      dedupe_key: `seed:word_known:${date}:${i}`,
    });
  }
  if (day.lesson) {
    events.push({
      kind: "grammar_credit",
      meta: { seed: true },
      dedupe_key: `seed:grammar_credit:${date}`,
    });
  }
  return events;
}

/** Idempotent (dedupe keys): re-running adds nothing. Uses the user's timezone for days. */
export async function seedProgress(
  db: Db,
  userId: string,
  language: Language = "ko",
  now: Date = new Date(),
): Promise<{ pointsTotal: number; streak: number }> {
  const settings = await getUserSettings(db, userId);
  const today = localDate(now, settings.timezone);
  let last = { pointsTotal: 0, streak: 0 };
  for (const day of seedPlan()) {
    const date = addDays(today, -day.offset);
    // Same time of day as `now`, shifted by whole days → that local date in the user's zone.
    const at = new Date(now.getTime() - day.offset * 86_400_000);
    const r = await recordActivity(db, { userId, language, events: eventsFor(day, date), now: at });
    last = { pointsTotal: r.pointsTotal, streak: r.streak.current };
  }
  return last;
}
