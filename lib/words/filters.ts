import { WORD_TYPES, type WordType } from "@/db/schema/words";
import type { WordFilters } from "./queries";

export const PAGE_SIZE = 50;

export type LibraryParams = {
  q: string;
  level: number | null;
  type: WordType | null;
  noExample: boolean;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parses `/words` search params (invalid values are ignored). */
export function parseLibraryParams(raw: Raw): LibraryParams {
  const q = (first(raw.q) ?? "").normalize("NFC").trim().slice(0, 100);
  const lv = Number(first(raw.level));
  const level = first(raw.level) !== undefined && [0, 1, 2, 3].includes(lv) ? lv : null;
  const t = first(raw.type);
  const type = t && (WORD_TYPES as readonly string[]).includes(t) ? (t as WordType) : null;
  const noExample = first(raw.noex) === "1";
  const p = Math.floor(Number(first(raw.page)));
  const page = Number.isFinite(p) && p > 1 ? p : 1;
  return { q, level, type, noExample, page };
}

export function toFilters(p: LibraryParams): WordFilters {
  return {
    q: p.q || undefined,
    levels: p.level === null ? undefined : [p.level],
    types: p.type ? [p.type] : undefined,
    needsExample: p.noExample || undefined,
  };
}

/** Builds a `/words?…` href from params with `patch` applied (page resets unless given). */
export function libraryHref(p: LibraryParams, patch: Partial<LibraryParams> = {}): string {
  const next = { ...p, page: 1, ...patch };
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.level !== null) sp.set("level", String(next.level));
  if (next.type) sp.set("type", next.type);
  if (next.noExample) sp.set("noex", "1");
  if (next.page > 1) sp.set("page", String(next.page));
  const s = sp.toString();
  return s ? `/words?${s}` : "/words";
}

export const TYPE_LABELS: Record<WordType, string> = {
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  pronoun: "Pronoun",
  numeral: "Numeral",
  determiner: "Determiner",
  particle: "Particle",
  counter: "Counter",
  interjection: "Interjection",
  expression: "Expression",
  other: "Other",
};
