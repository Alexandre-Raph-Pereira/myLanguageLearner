import "server-only";
import { and, eq } from "drizzle-orm";
import { dailyProgress } from "@/db/schema";
import type { Db } from "@/db/types";
import { localDate } from "@/lib/progress/days";
import { getLanguageProfile, getUserSettings } from "@/lib/settings";
import type { Scope } from "./queries";

/** Today's word-goal progress (words answered today / daily goal) for the active language. */
export async function todayWordGoal(
  db: Db,
  s: Scope,
  now = new Date(),
): Promise<{ date: string; words: number; goal: number }> {
  const settings = await getUserSettings(db, s.userId);
  const profile = await getLanguageProfile(db, s.userId, s.language);
  const date = localDate(now, settings.timezone);
  const [row] = await db
    .select({ words: dailyProgress.wordsAnswered })
    .from(dailyProgress)
    .where(
      and(
        eq(dailyProgress.userId, s.userId),
        eq(dailyProgress.language, s.language),
        eq(dailyProgress.localDate, date),
      ),
    );
  return { date, words: row?.words ?? 0, goal: profile?.dailyGoalWords ?? 20 };
}
