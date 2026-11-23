/** Pure helpers for AI drafts (client-safe). */
import type { GrammarDraft, GrammarInputRaw, RelatedLesson, ReviewDraft } from "./schema";

const nfc = (s: string | null | undefined) => (s ?? "").normalize("NFC").trim();

/** NFC + trim every string, drop empty variants / examples, clamp the level. */
export function normalizeDraft<T extends Omit<GrammarDraft, "related">>(d: T): T {
  const variants: string[] = [];
  for (const v of d.variants.map(nfc)) if (v && !variants.includes(v)) variants.push(v);
  const level =
    d.level != null && Number.isInteger(d.level) && d.level >= 1 && d.level <= 6 ? d.level : null;
  return {
    ...d,
    title: nfc(d.title),
    pattern: nfc(d.pattern) || nfc(d.title),
    variants,
    meaning_short: nfc(d.meaning_short),
    level,
    description_md: nfc(d.description_md),
    formation_md: nfc(d.formation_md),
    examples: d.examples
      .map((e) => ({ sentence: nfc(e.sentence), translation: nfc(e.translation) }))
      .filter((e) => e.sentence !== ""),
    similar_md: nfc(d.similar_md),
  };
}

/** Maps `related[].ref` codes (G1…) to existing lessons; unknown codes and duplicates are dropped. */
export function resolveRelated(
  related: GrammarDraft["related"],
  lessons: readonly { code: string; id: string; title: string }[],
): RelatedLesson[] {
  const byCode = new Map(lessons.map((l) => [l.code.toUpperCase(), l]));
  const out: RelatedLesson[] = [];
  for (const r of related) {
    const l = byCode.get(r.ref.trim().toUpperCase());
    if (!l || out.some((o) => o.id === l.id)) continue;
    out.push({ id: l.id, title: l.title, kind: r.kind, note: r.note ? nfc(r.note) : null });
  }
  return out;
}

/** AI draft → review draft. */
export function toReviewDraft(
  d: GrammarDraft,
  lessons: readonly { code: string; id: string; title: string }[],
): ReviewDraft {
  const { related, ...rest } = d;
  return { ...normalizeDraft(rest), related: resolveRelated(related, lessons) };
}

/** Review draft → the JSON sent to `grammar.rewrite` (related as readable titles). */
export function draftForRewrite(d: ReviewDraft): string {
  const { related, ...rest } = d;
  return JSON.stringify({
    ...rest,
    related: related.map((r) => ({ ref: r.title, kind: r.kind, note: r.note ?? null })),
  });
}

/** The pattern used for saving / duplicate checks: the title when the pattern is left empty. */
export function effectivePattern(d: { title: string; pattern: string }): string {
  return d.pattern.trim() ? d.pattern : d.title;
}

/** Review draft → raw `grammarInput` (related reduced to ids, empty pattern = title). */
export function toGrammarInputRaw(d: ReviewDraft): GrammarInputRaw {
  return {
    ...d,
    pattern: effectivePattern(d),
    related: d.related.map((r) => ({ id: r.id, kind: r.kind, note: r.note ?? null })),
  };
}

/** Stored lesson → review draft (edit page). */
export function lessonToDraft(l: {
  title: string;
  pattern: string;
  variants: string[];
  meaningShort: string;
  level: number | null;
  descriptionMd: string;
  formationMd: string;
  examples: { sentence: string; translation: string }[];
  similarMd: string;
  links: { id: string; title: string; kind: RelatedLesson["kind"]; note: string | null }[];
}): ReviewDraft {
  return {
    title: l.title,
    pattern: l.pattern,
    variants: l.variants,
    meaning_short: l.meaningShort,
    level: l.level,
    description_md: l.descriptionMd,
    formation_md: l.formationMd,
    examples: l.examples,
    similar_md: l.similarMd,
    related: l.links.map((k) => ({ id: k.id, title: k.title, kind: k.kind, note: k.note })),
  };
}

/** First zod issue message per top-level field. */
export function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!(key in out)) out[key] = i.message;
  }
  return out;
}

/** A partially written lesson as plain notes ("Complete with AI" sends it to `grammar.structure`). */
export function draftToNotes(d: ReviewDraft): string {
  const lines: string[] = [];
  const add = (label: string, v: string) => {
    if (v.trim()) lines.push(`${label}: ${v.trim()}`);
  };
  add("Title", d.title);
  if (d.pattern.trim() && d.pattern.trim() !== d.title.trim()) add("Pattern", d.pattern);
  add("Forms", d.variants.join(", "));
  add("Meaning", d.meaning_short);
  if (d.level) add("Level", String(d.level));
  add("Explanation", d.description_md);
  add("Formation", d.formation_md);
  const examples = d.examples.filter((e) => e.sentence.trim());
  if (examples.length) {
    lines.push("Examples:");
    for (const e of examples) {
      lines.push(
        `- ${e.sentence.trim()}${e.translation.trim() ? ` = ${e.translation.trim()}` : ""}`,
      );
    }
  }
  add("Similar / be careful", d.similar_md);
  if (d.related.length) add("Related lessons", d.related.map((r) => r.title).join(", "));
  return lines.join("\n");
}
