import "server-only";
import { and, eq } from "drizzle-orm";
import { grammarLinks, grammarPoints } from "@/db/schema/grammar";
import type { Db } from "@/db/types";
import type { LessonFile } from "./lesson-file";
import { normPattern } from "./normalize";
import { createGrammar, getGrammar, updateGrammar, type Scope } from "./queries";
import { grammarInput, type GrammarInput } from "./schema";

export type ImportFileResult = {
  created: string[];
  updated: string[];
  skipped: string[];
  /** New links (pairs: both directions are stored). */
  linksAdded: number;
  /** "<lesson title> → <pattern>" for related patterns with no lesson yet. */
  unresolved: string[];
};

/** Lesson file → saved-lesson input (examples keep sentence + translation; the "Use" label is file-only). */
export function lessonFileToInput(l: LessonFile, related: GrammarInput["related"] = []) {
  return grammarInput.parse({
    title: l.title,
    pattern: l.pattern,
    variants: l.variants,
    meaning_short: l.meaningShort,
    level: l.level,
    description_md: l.descriptionMd,
    formation_md: l.formationMd,
    examples: l.examples.map((e) => ({ sentence: e.ko, translation: e.en })),
    similar_md: l.similarMd,
    related,
  });
}

/**
 * Imports hand-written lesson files (`content/grammar/<lang>/*.md`). A lesson is matched to an
 * existing one by its pattern (`normPattern`): new ones are created (`source = import_text`),
 * existing ones are skipped unless `update` (then overwritten, keeping their links). `related`
 * patterns are then linked (both directions, additive: links never get removed); patterns
 * without a lesson are reported and linked on a later run. No progress credit: this is a bulk load.
 */
export async function importLessonFiles(
  db: Db,
  s: Scope,
  lessons: readonly LessonFile[],
  opts: { update?: boolean } = {},
): Promise<ImportFileResult> {
  const res: ImportFileResult = {
    created: [],
    updated: [],
    skipped: [],
    linksAdded: 0,
    unresolved: [],
  };

  const existing = async () =>
    db
      .select({ id: grammarPoints.id, title: grammarPoints.title, pattern: grammarPoints.pattern })
      .from(grammarPoints)
      .where(and(eq(grammarPoints.userId, s.userId), eq(grammarPoints.language, s.language)));
  const byPattern = (rows: { id: string; title: string; pattern: string }[]) => {
    const m = new Map<string, string>();
    for (const r of rows) {
      for (const k of [normPattern(r.pattern), normPattern(r.title)]) if (!m.has(k)) m.set(k, r.id);
    }
    return m;
  };

  const before = byPattern(await existing());
  const idOf = new Map<LessonFile, string>();
  for (const l of lessons) {
    const id = before.get(normPattern(l.pattern));
    if (!id) {
      const row = await createGrammar(db, s, lessonFileToInput(l), "import_text");
      idOf.set(l, row.id);
      res.created.push(l.title);
    } else if (opts.update) {
      const current = await getGrammar(db, s, id);
      const keep = (current?.links ?? []).map((k) => ({ id: k.id, kind: k.kind, note: k.note }));
      await updateGrammar(db, s, id, lessonFileToInput(l, keep));
      idOf.set(l, id);
      res.updated.push(l.title);
    } else {
      idOf.set(l, id);
      res.skipped.push(l.title);
    }
  }

  const all = byPattern(await existing());
  const rows: (typeof grammarLinks.$inferInsert)[] = [];
  for (const l of lessons) {
    const id = idOf.get(l)!;
    for (const r of l.related) {
      const relatedId = all.get(normPattern(r.pattern));
      if (!relatedId) {
        res.unresolved.push(`${l.title} → ${r.pattern}`);
        continue;
      }
      if (relatedId === id) continue;
      const base = { userId: s.userId, kind: r.kind, note: r.note ?? null };
      rows.push(
        { ...base, grammarId: id, relatedId },
        { ...base, grammarId: relatedId, relatedId: id },
      );
    }
  }
  if (rows.length > 0) {
    const inserted = await db
      .insert(grammarLinks)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: grammarLinks.grammarId });
    res.linksAdded = Math.round(inserted.length / 2);
  }
  return res;
}
