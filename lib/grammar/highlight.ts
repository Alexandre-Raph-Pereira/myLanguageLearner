/**
 * Simple pattern highlighting in example sentences (pure, client-safe).
 * Candidates come from the pattern + variants: leading dashes removed, `(X)` optional parts
 * expanded, a leading jamo dropped (it merges into the previous syllable: `-ㄹ 수 있다` →
 * `수 있다`) and the dictionary `다` dropped (`수 있다` → `수 있`, matches `수 있어요`).
 */

export type Segment = { text: string; match: boolean };

const LEADING_DASHES = /^[~\-–—‐‑‒―〜～]+/u;
const LEADING_JAMO = /^[ㄱ-ㅎ]/u;

function expandOptional(s: string): string[] {
  const m = /\(([^()]*)\)/.exec(s);
  if (!m) return [s];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  return [...expandOptional(before + m[1] + after), ...expandOptional(before + after)];
}

/** Match candidates, longest first. */
export function highlightCandidates(patterns: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of patterns) {
    const base = raw.normalize("NFC").trim().replace(LEADING_DASHES, "").trim();
    if (!base || base.includes("/")) continue;
    for (const form of expandOptional(base)) {
      const noJamo = form.replace(LEADING_JAMO, "").trim();
      for (const f of [form, noJamo]) {
        if (!f || LEADING_JAMO.test(f)) continue;
        out.add(f);
        if (f.length > 2 && f.endsWith("다")) out.add(f.slice(0, -1).trim());
      }
    }
  }
  return [...out].filter((c) => c.length > 0).sort((a, b) => b.length - a.length);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits `sentence` into plain / matched segments (first-longest match wins, no overlaps). */
export function highlight(sentence: string, patterns: readonly string[]): Segment[] {
  const text = sentence.normalize("NFC");
  const candidates = highlightCandidates(patterns);
  if (candidates.length === 0 || !text) return [{ text, match: false }];
  const re = new RegExp(candidates.map(escapeRegExp).join("|"), "giu");
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m[0] === "") continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}
