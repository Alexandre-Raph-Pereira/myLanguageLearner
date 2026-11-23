/**
 * Grammar pattern normalization (pure, client-safe). Used for `match_keys`
 * (duplicate detection, annotation of passages in plan 05).
 */

const LEADING_DASHES = /^[~\-–—‐‑‒―〜～]+/u;

/**
 * Comparison key of a pattern: NFC, no whitespace, leading `~ – — -` removed,
 * Latin lowercased. `-(으)ㄹ 수 있다` → `(으)ㄹ수있다`.
 */
export function normPattern(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, "").replace(LEADING_DASHES, "").toLowerCase();
}

/** Distinct non-empty `normPattern` of pattern + variants (order kept). */
export function matchKeys(draft: { pattern: string; variants: readonly string[] }): string[] {
  const out: string[] = [];
  for (const s of [draft.pattern, ...draft.variants]) {
    const k = normPattern(s);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

export type DuplicateCandidate = { id: string; title: string; matchKeys: readonly string[] };

/** Existing lessons sharing at least one match key with the draft. */
export function findPossibleDuplicates<T extends DuplicateCandidate>(
  draft: { pattern: string; variants: readonly string[] },
  existing: readonly T[],
  excludeId?: string,
): T[] {
  const keys = new Set(matchKeys(draft));
  if (keys.size === 0) return [];
  return existing.filter((e) => e.id !== excludeId && e.matchKeys.some((k) => keys.has(k)));
}
