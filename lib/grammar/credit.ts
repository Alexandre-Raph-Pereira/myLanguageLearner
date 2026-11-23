import "server-only";
import type { Db } from "@/db/types";
import { localDate } from "@/lib/progress/days";
import { recordActivity, type ActivityResult } from "@/lib/progress/record";
import { getUserSettings } from "@/lib/settings";
import type { Scope } from "./queries";

export type CreditReason = "studied" | "saved";

export function creditDedupeKey(lessonId: string, date: string): string {
  return `grammar_credit:${lessonId}:${date}`;
}

/**
 * Credits a lesson for today's grammar goal (+10, once per lesson per local day).
 * Used by "Mark as studied today" and when a lesson is saved from review.
 */
export async function creditLesson(
  db: Db,
  s: Scope,
  lessonId: string,
  reason: CreditReason,
  now = new Date(),
): Promise<ActivityResult> {
  const settings = await getUserSettings(db, s.userId);
  const date = localDate(now, settings.timezone);
  return recordActivity(db, {
    userId: s.userId,
    language: s.language,
    now,
    events: [
      {
        kind: "grammar_credit",
        ref_id: lessonId,
        meta: { reason },
        dedupe_key: creditDedupeKey(lessonId, date),
      },
    ],
  });
}

/** Today's local date for the user (studied-today checks). */
export async function todayFor(db: Db, userId: string, now = new Date()): Promise<string> {
  const settings = await getUserSettings(db, userId);
  return localDate(now, settings.timezone);
}
