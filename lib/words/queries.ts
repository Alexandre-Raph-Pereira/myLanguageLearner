import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { ContentSource, ContentStatus } from "@/db/schema/enums";
import { words, type NewWord, type Word, type WordType } from "@/db/schema/words";
import type { Db } from "@/db/types";
import type { Language } from "@/lib/languages";
import { meaningKey } from "@/lib/text/normalize";
import { wordKey, type WordInput } from "./input";

/** Every query is scoped by user + language. */
export type Scope = { userId: string; language: Language };

export type WordFilters = {
  q?: string;
  types?: WordType[];
  levels?: number[];
  needsExample?: boolean;
  /** Default `active` (suggested words wait in a review queue). */
  status?: ContentStatus;
};

const scoped = (s: Scope) => and(eq(words.userId, s.userId), eq(words.language, s.language));

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function filterWhere(s: Scope, f: WordFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [scoped(s), eq(words.status, f.status ?? "active")];
  const q = f.q?.normalize("NFC").trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    conds.push(
      or(
        sql`${words.term} ilike ${like}`,
        sql`array_to_string(${words.meanings}, ' ') ilike ${like}`,
      ),
    );
  }
  if (f.types?.length) conds.push(inArray(words.type, f.types));
  if (f.levels?.length) conds.push(inArray(words.level, f.levels));
  if (f.needsExample) conds.push(isNull(words.exampleSentence));
  return and(...conds);
}

export async function listWords(
  db: Db,
  s: Scope,
  f: WordFilters = {},
  page: { limit?: number; offset?: number } = {},
): Promise<{ rows: Word[]; total: number }> {
  const where = filterWhere(s, f);
  const rows = await db
    .select()
    .from(words)
    .where(where)
    .orderBy(desc(words.createdAt), asc(words.term), asc(words.id))
    .limit(page.limit ?? 50)
    .offset(page.offset ?? 0);
  const [{ n }] = await db.select({ n: count() }).from(words).where(where);
  return { rows, total: n };
}

export type WordStats = {
  total: number;
  byLevel: [number, number, number, number];
  known: number;
  needsExample: number;
  byType: Partial<Record<WordType, number>>;
  due: number;
};

/** Counts for the library header, filter chips and Home (active words only). */
export async function wordStats(db: Db, s: Scope, now = new Date()): Promise<WordStats> {
  const where = and(scoped(s), eq(words.status, "active"));
  const levelRows = await db
    .select({ level: words.level, n: count() })
    .from(words)
    .where(where)
    .groupBy(words.level);
  const typeRows = await db
    .select({ type: words.type, n: count() })
    .from(words)
    .where(where)
    .groupBy(words.type);
  const [{ needsExample, due }] = await db
    .select({
      needsExample: sql<number>`count(*) filter (where ${words.exampleSentence} is null)`.mapWith(
        Number,
      ),
      due: sql<number>`count(*) filter (where ${words.dueAt} <= ${now.toISOString()}::timestamptz)`.mapWith(
        Number,
      ),
    })
    .from(words)
    .where(where);
  const byLevel: [number, number, number, number] = [0, 0, 0, 0];
  for (const r of levelRows) byLevel[r.level] = r.n;
  const byType: Partial<Record<WordType, number>> = {};
  for (const r of typeRows) byType[r.type] = r.n;
  return {
    total: byLevel.reduce((a, b) => a + b, 0),
    byLevel,
    known: byLevel[2] + byLevel[3],
    needsExample,
    byType,
    due,
  };
}

export async function getWord(db: Db, s: Scope, id: string): Promise<Word | null> {
  const [row] = await db
    .select()
    .from(words)
    .where(and(scoped(s), eq(words.id, id)));
  return row ?? null;
}

export async function getWordsByIds(db: Db, s: Scope, ids: string[]): Promise<Word[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(words)
    .where(and(scoped(s), inArray(words.id, ids)));
}

function toColumns(input: WordInput) {
  return {
    term: input.term,
    meanings: input.meanings,
    meaningKey: meaningKey(input.meanings[0]),
    type: input.type,
    exampleSentence: input.exampleSentence,
    exampleTranslation: input.exampleTranslation,
    notes: input.notes,
  };
}

export class DuplicateWordError extends Error {
  constructor() {
    super("This word with the same primary meaning already exists.");
    this.name = "DuplicateWordError";
  }
}

function isUniqueViolation(e: unknown): boolean {
  for (let err: unknown = e; err; err = (err as { cause?: unknown }).cause) {
    if ((err as { code?: string }).code === "23505") return true;
    if (err instanceof Error && /duplicate key|unique constraint/i.test(err.message)) return true;
  }
  return false;
}

export async function createWord(
  db: Db,
  s: Scope,
  input: WordInput,
  source: ContentSource = "manual",
): Promise<Word> {
  try {
    const [row] = await db
      .insert(words)
      .values({ userId: s.userId, language: s.language, source, ...toColumns(input) })
      .returning();
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateWordError();
    throw e;
  }
}

export async function updateWord(
  db: Db,
  s: Scope,
  id: string,
  input: WordInput,
): Promise<Word | null> {
  try {
    const [row] = await db
      .update(words)
      .set(toColumns(input))
      .where(and(scoped(s), eq(words.id, id)))
      .returning();
    return row ?? null;
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateWordError();
    throw e;
  }
}

export async function deleteWord(db: Db, s: Scope, id: string): Promise<boolean> {
  const rows = await db
    .delete(words)
    .where(and(scoped(s), eq(words.id, id)))
    .returning({ id: words.id });
  return rows.length > 0;
}

/** Applies a scheduler patch (level, due date, counters) to one word. */
export async function patchSchedule(
  db: Db,
  s: Scope,
  id: string,
  patch: Partial<
    Pick<
      NewWord,
      | "level"
      | "intervalDays"
      | "dueAt"
      | "lastReviewedAt"
      | "correctStreak"
      | "timesCorrect"
      | "timesFailed"
      | "timesLookedUp"
      | "meanings"
    >
  >,
): Promise<Word | null> {
  const [row] = await db
    .update(words)
    .set(patch)
    .where(and(scoped(s), eq(words.id, id)))
    .returning();
  return row ?? null;
}

export type BulkResult = { inserted: number; updated: number; skipped: number };

/**
 * Inserts many words in one transaction (batches of 500). Rows whose term + primary
 * meaning already exist are skipped, or — with `updateExisting` — get the new example
 * (when they have one) and any new meanings appended.
 */
export async function bulkInsert(
  db: Db,
  s: Scope,
  rows: WordInput[],
  opts: { source: ContentSource; updateExisting?: boolean; batchSize?: number },
): Promise<BulkResult> {
  // Duplicates inside the input would make one statement touch a row twice.
  const unique = new Map<string, WordInput>();
  for (const r of rows) {
    const key = wordKey(r.term, r.meanings[0]);
    if (!unique.has(key)) unique.set(key, r);
  }
  const list = [...unique.values()];
  const result: BulkResult = { inserted: 0, updated: 0, skipped: rows.length - list.length };
  const size = opts.batchSize ?? 500;

  await db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as Db;
    for (let i = 0; i < list.length; i += size) {
      const values = list.slice(i, i + size).map((r) => ({
        userId: s.userId,
        language: s.language,
        source: opts.source,
        ...toColumns(r),
      }));
      const target = [words.userId, words.language, words.term, words.meaningKey];
      if (opts.updateExisting) {
        const out = await tx
          .insert(words)
          .values(values)
          .onConflictDoUpdate({
            target,
            set: {
              exampleSentence: sql`coalesce(excluded.example_sentence, ${words.exampleSentence})`,
              exampleTranslation: sql`case when excluded.example_sentence is not null then excluded.example_translation else ${words.exampleTranslation} end`,
              meanings: sql`${words.meanings} || array(select m from unnest(excluded.meanings) as m where m <> all(${words.meanings}))`,
              type: sql`case when excluded.type <> 'other' then excluded.type else ${words.type} end`,
              updatedAt: sql`now()`,
            },
          })
          .returning({ inserted: sql<boolean>`(xmax = 0)` });
        for (const r of out) {
          if (r.inserted) result.inserted++;
          else result.updated++;
        }
      } else {
        const out = await tx
          .insert(words)
          .values(values)
          .onConflictDoNothing({ target })
          .returning({ id: words.id });
        result.inserted += out.length;
        result.skipped += values.length - out.length;
      }
    }
  });
  return result;
}

/** Keys (`wordKey`) of the given rows that already exist in the bank (any status). */
export async function findDuplicates(
  db: Db,
  s: Scope,
  rows: { term: string; meanings: string[] }[],
): Promise<Set<string>> {
  const terms = [...new Set(rows.filter((r) => r.meanings.length > 0).map((r) => r.term))];
  const existing = new Set<string>();
  for (let i = 0; i < terms.length; i += 1000) {
    const found = await db
      .select({ term: words.term, meaningKey: words.meaningKey })
      .from(words)
      .where(and(scoped(s), inArray(words.term, terms.slice(i, i + 1000))));
    for (const f of found) existing.add(`${f.term}\u0000${f.meaningKey}`);
  }
  const out = new Set<string>();
  for (const r of rows) {
    if (r.meanings.length === 0) continue;
    const key = wordKey(r.term, r.meanings[0]);
    if (existing.has(key)) out.add(key);
  }
  return out;
}

export type LibraryEntry = Pick<Word, "id" | "term" | "meanings" | "type" | "level">;

/** Compact index of the whole active bank (answer alternatives, TOPIK lookups in plan 05). */
export async function libraryIndex(db: Db, s: Scope): Promise<LibraryEntry[]> {
  return db
    .select({
      id: words.id,
      term: words.term,
      meanings: words.meanings,
      type: words.type,
      level: words.level,
    })
    .from(words)
    .where(and(scoped(s), eq(words.status, "active")))
    .orderBy(asc(words.term));
}

/** Candidates for a word test: active words matching the type filter. */
export async function testCandidates(
  db: Db,
  s: Scope,
  f: { types?: WordType[]; includeNoExample?: boolean },
): Promise<Pick<Word, "id" | "level" | "dueAt">[]> {
  const conds: (SQL | undefined)[] = [scoped(s), eq(words.status, "active")];
  if (f.types?.length) conds.push(inArray(words.type, f.types));
  if (f.includeNoExample === false) conds.push(sql`${words.exampleSentence} is not null`);
  return db
    .select({ id: words.id, level: words.level, dueAt: words.dueAt })
    .from(words)
    .where(and(...conds));
}

/** Number of active words due at `at`. */
export async function countDue(db: Db, s: Scope, at: Date): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(words)
    .where(and(scoped(s), eq(words.status, "active"), lte(words.dueAt, at)));
  return n;
}
