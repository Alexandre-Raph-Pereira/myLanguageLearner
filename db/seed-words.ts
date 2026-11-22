import { eq } from "drizzle-orm";
import type { Db } from "./types";
import { words } from "./schema/words";
import { SEED_WORDS } from "./seed-words-data";
import { clean, meaningKey } from "@/lib/text/normalize";

const DAY = 86_400_000;
const INTERVAL_FOR_LEVEL = [0, 1, 3, 7] as const;

/** Dev seed: ~40 Korean words of mixed types / levels (idempotent: existing words are kept). */
export async function seedWords(db: Db, userId: string, now = new Date()): Promise<number> {
  const rows = SEED_WORDS.map((w) => ({
    userId,
    language: "ko",
    term: clean(w.term),
    meanings: w.meanings.map(clean),
    meaningKey: meaningKey(w.meanings[0]),
    type: w.type,
    exampleSentence: w.example ? clean(w.example[0]) : null,
    exampleTranslation: w.example ? w.example[1] : null,
    level: w.level,
    intervalDays: INTERVAL_FOR_LEVEL[w.level],
    dueAt: new Date(now.getTime() + w.dueInDays * DAY - 60_000),
    correctStreak: w.level,
    timesCorrect: w.level,
    source: "manual" as const,
  }));
  const inserted = await db
    .insert(words)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: words.id });
  return inserted.length;
}

/** Number of words of the user (used by tests). */
export async function countWords(db: Db, userId: string): Promise<number> {
  return (await db.select({ id: words.id }).from(words).where(eq(words.userId, userId))).length;
}
