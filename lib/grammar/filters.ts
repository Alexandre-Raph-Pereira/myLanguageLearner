/** `/grammar` URL params (search + level filter). Pure. */

export type GrammarParams = { q: string; level: number | null };

export const GRAMMAR_LEVELS = [1, 2, 3, 4, 5, 6] as const;

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseGrammarParams(raw: Raw): GrammarParams {
  const q = (first(raw.q) ?? "").normalize("NFC").trim().slice(0, 100);
  const n = Number(first(raw.level));
  const level = Number.isInteger(n) && n >= 1 && n <= 6 ? n : null;
  return { q, level };
}

export function grammarHref(p: GrammarParams, patch: Partial<GrammarParams> = {}): string {
  const next = { ...p, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.level !== null) sp.set("level", String(next.level));
  const qs = sp.toString();
  return qs ? `/grammar?${qs}` : "/grammar";
}
