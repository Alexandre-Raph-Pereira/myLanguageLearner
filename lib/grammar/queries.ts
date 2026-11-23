import "server-only";
import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { ContentSource, ContentStatus } from "@/db/schema/enums";
import {
  grammarLinks,
  grammarPoints,
  type GrammarLinkKind,
  type GrammarPoint,
} from "@/db/schema/grammar";
import { activityEvents } from "@/db/schema/progress";
import type { Db } from "@/db/types";
import type { Language } from "@/lib/languages";
import { matchKeys } from "./normalize";
import type { GrammarInput } from "./schema";

/** Every query is scoped by user + language. */
export type Scope = { userId: string; language: Language };

export type GrammarFilters = {
  q?: string;
  level?: number | null;
  /** Default `active`. */
  status?: ContentStatus;
};

const scoped = (s: Scope) =>
  and(eq(grammarPoints.userId, s.userId), eq(grammarPoints.language, s.language));

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type GrammarListRow = Pick<
  GrammarPoint,
  "id" | "title" | "pattern" | "meaningShort" | "level" | "createdAt"
>;

/** Library list (search title / pattern / variants / meaning, level filter), newest first. */
export async function listGrammar(
  db: Db,
  s: Scope,
  f: GrammarFilters = {},
  limit = 500,
): Promise<GrammarListRow[]> {
  const conds: (SQL | undefined)[] = [scoped(s), eq(grammarPoints.status, f.status ?? "active")];
  const q = f.q?.normalize("NFC").trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    const compact = `%${escapeLike(q.replace(/\s+/g, ""))}%`;
    conds.push(
      or(
        sql`${grammarPoints.title} ilike ${like}`,
        sql`${grammarPoints.pattern} ilike ${like}`,
        sql`${grammarPoints.meaningShort} ilike ${like}`,
        sql`array_to_string(${grammarPoints.variants}, ' ') ilike ${like}`,
        sql`array_to_string(${grammarPoints.matchKeys}, ' ') ilike ${compact}`,
      ),
    );
  }
  if (f.level) conds.push(eq(grammarPoints.level, f.level));
  return db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      pattern: grammarPoints.pattern,
      meaningShort: grammarPoints.meaningShort,
      level: grammarPoints.level,
      createdAt: grammarPoints.createdAt,
    })
    .from(grammarPoints)
    .where(and(...conds))
    .orderBy(desc(grammarPoints.createdAt), asc(grammarPoints.title), asc(grammarPoints.id))
    .limit(limit);
}

export async function countGrammar(db: Db, s: Scope): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(grammarPoints)
    .where(and(scoped(s), eq(grammarPoints.status, "active")));
  return row?.n ?? 0;
}

export type LinkedLesson = {
  id: string;
  title: string;
  pattern: string;
  meaningShort: string;
  kind: GrammarLinkKind;
  note: string | null;
};

export type GrammarWithLinks = GrammarPoint & { links: LinkedLesson[] };

export async function getGrammar(db: Db, s: Scope, id: string): Promise<GrammarWithLinks | null> {
  const [row] = await db
    .select()
    .from(grammarPoints)
    .where(and(scoped(s), eq(grammarPoints.id, id)));
  if (!row) return null;
  const links = await db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      pattern: grammarPoints.pattern,
      meaningShort: grammarPoints.meaningShort,
      kind: grammarLinks.kind,
      note: grammarLinks.note,
    })
    .from(grammarLinks)
    .innerJoin(grammarPoints, eq(grammarPoints.id, grammarLinks.relatedId))
    .where(and(eq(grammarLinks.userId, s.userId), eq(grammarLinks.grammarId, id), scoped(s)))
    .orderBy(asc(grammarPoints.title));
  return { ...row, links };
}

function toColumns(input: GrammarInput) {
  return {
    title: input.title,
    pattern: input.pattern,
    variants: input.variants,
    matchKeys: matchKeys(input),
    meaningShort: input.meaning_short,
    level: input.level,
    descriptionMd: input.description_md,
    formationMd: input.formation_md,
    examples: input.examples,
    similarMd: input.similar_md,
  };
}

/** Replaces every link of `id` (both directions) with `related`; foreign ids are ignored. */
async function writeLinks(db: Db, s: Scope, id: string, related: GrammarInput["related"]) {
  await db
    .delete(grammarLinks)
    .where(
      and(
        eq(grammarLinks.userId, s.userId),
        or(eq(grammarLinks.grammarId, id), eq(grammarLinks.relatedId, id)),
      ),
    );
  const wanted = new Map<string, GrammarInput["related"][number]>();
  for (const r of related) if (r.id !== id && !wanted.has(r.id)) wanted.set(r.id, r);
  if (wanted.size === 0) return;
  const owned = await db
    .select({ id: grammarPoints.id })
    .from(grammarPoints)
    .where(and(scoped(s), inArray(grammarPoints.id, [...wanted.keys()])));
  const rows = owned.flatMap(({ id: relatedId }) => {
    const r = wanted.get(relatedId)!;
    const base = { userId: s.userId, kind: r.kind, note: r.note ?? null };
    return [
      { ...base, grammarId: id, relatedId },
      { ...base, grammarId: relatedId, relatedId: id },
    ];
  });
  if (rows.length > 0) await db.insert(grammarLinks).values(rows).onConflictDoNothing();
}

export async function createGrammar(
  db: Db,
  s: Scope,
  input: GrammarInput,
  source: ContentSource = "manual",
): Promise<GrammarPoint> {
  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as Db;
    const [row] = await tx
      .insert(grammarPoints)
      .values({ userId: s.userId, language: s.language, source, ...toColumns(input) })
      .returning();
    await writeLinks(tx, s, row.id, input.related);
    return row;
  });
}

export async function updateGrammar(
  db: Db,
  s: Scope,
  id: string,
  input: GrammarInput,
): Promise<GrammarPoint | null> {
  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as Db;
    const [row] = await tx
      .update(grammarPoints)
      .set(toColumns(input))
      .where(and(scoped(s), eq(grammarPoints.id, id)))
      .returning();
    if (!row) return null;
    await writeLinks(tx, s, id, input.related);
    return row;
  });
}

export async function deleteGrammar(db: Db, s: Scope, id: string): Promise<boolean> {
  const rows = await db
    .delete(grammarPoints)
    .where(and(scoped(s), eq(grammarPoints.id, id)))
    .returning({ id: grammarPoints.id });
  return rows.length > 0;
}

export type DuplicateLesson = { id: string; title: string; matchKeys: string[] };

/** Lessons sharing any match key with the given pattern / variants (GIN `&&`). */
export async function findDuplicateLessons(
  db: Db,
  s: Scope,
  draft: { pattern: string; variants: readonly string[] },
  excludeId?: string,
): Promise<DuplicateLesson[]> {
  const keys = matchKeys(draft);
  if (keys.length === 0) return [];
  const rows = await db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      matchKeys: grammarPoints.matchKeys,
    })
    .from(grammarPoints)
    .where(
      and(
        scoped(s),
        sql`${grammarPoints.matchKeys} && ${sql`array[${sql.join(
          keys.map((k) => sql`${k}`),
          sql`, `,
        )}]::text[]`}`,
      ),
    )
    .orderBy(asc(grammarPoints.title));
  return rows.filter((r) => r.id !== excludeId);
}

export type CompactLesson = { code: string; id: string; title: string; meaningShort: string };

/** `G1…Gn` codes of the user's active lessons (oldest first, stable) for AI prompts. */
export async function compactListForPrompt(db: Db, s: Scope): Promise<CompactLesson[]> {
  const rows = await db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      meaningShort: grammarPoints.meaningShort,
    })
    .from(grammarPoints)
    .where(and(scoped(s), eq(grammarPoints.status, "active")))
    .orderBy(asc(grammarPoints.createdAt), asc(grammarPoints.id));
  return rows.map((r, i) => ({ code: `G${i + 1}`, ...r }));
}

export type GrammarIndexEntry = Pick<
  GrammarPoint,
  "id" | "title" | "pattern" | "variants" | "meaningShort" | "level" | "descriptionMd" | "examples"
>;

/** Compact library for annotation / lookups (plan 05 cache). */
export async function libraryIndex(db: Db, s: Scope): Promise<GrammarIndexEntry[]> {
  return db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      pattern: grammarPoints.pattern,
      variants: grammarPoints.variants,
      meaningShort: grammarPoints.meaningShort,
      level: grammarPoints.level,
      descriptionMd: grammarPoints.descriptionMd,
      examples: grammarPoints.examples,
    })
    .from(grammarPoints)
    .where(and(scoped(s), eq(grammarPoints.status, "active")))
    .orderBy(asc(grammarPoints.title));
}

/** Ids of lessons credited (`grammar_credit`) on the given local day. */
export async function creditedLessonIds(db: Db, s: Scope, localDate: string): Promise<Set<string>> {
  const rows = await db
    .select({ refId: activityEvents.refId })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.userId, s.userId),
        eq(activityEvents.language, s.language),
        eq(activityEvents.kind, "grammar_credit"),
        eq(activityEvents.localDate, localDate),
      ),
    );
  return new Set(rows.map((r) => r.refId).filter((id): id is string => id !== null));
}
