/** Pure helpers for AI drafts (client-safe). */
import type { GrammarDraft, RelatedLesson, ReviewDraft } from "./schema";

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
