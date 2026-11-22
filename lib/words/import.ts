import Papa from "papaparse";
import { WORD_TYPES, type WordType } from "@/db/schema/words";
import { clean, cleanOrNull } from "@/lib/text/normalize";
import { dedupeMeanings, wordKey } from "./input";

/** Pure helpers for CSV/TSV import (Quizlet export) and the shared import preview. */

export type Separator = "\t" | "," | ";" | string;

export const IMPORT_FIELDS = [
  "term",
  "meaning",
  "example_sentence",
  "example_translation",
  "type",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
/** Column index per field (null = not mapped). */
export type Mapping = Record<ImportField, number | null>;

export type MeaningSplit = { semicolon: boolean; comma: boolean; slash: boolean };
export const DEFAULT_SPLIT: MeaningSplit = { semicolon: true, comma: false, slash: false };

/** Most frequent candidate separator in the first lines (tab wins ties: Quizlet default). */
export function detectSeparator(text: string): "\t" | "," | ";" {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 20);
  const score = (sep: string) =>
    lines.reduce((a, l) => a + (l.split(sep).length - 1 > 0 ? 1 : 0), 0) * 1000 +
    lines.reduce((a, l) => a + l.split(sep).length - 1, 0);
  const candidates: ("\t" | "," | ";")[] = ["\t", ";", ","];
  let best: "\t" | "," | ";" = "\t";
  let bestScore = -1;
  for (const c of candidates) {
    const s = score(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/** Parses delimited text into NFC cells (empty lines skipped). */
export function parseTable(text: string, separator: Separator): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    delimiter: separator,
    skipEmptyLines: "greedy",
    // Quizlet exports are not quoted; a lone quote inside a cell must stay literal.
    quoteChar: '"',
  });
  return result.data.map((row) => row.map((c) => (c ?? "").normalize("NFC")));
}

export function columnCount(table: string[][]): number {
  return table.reduce((a, r) => Math.max(a, r.length), 0);
}

/** 2 columns = term, meaning (Quizlet); 3 = term, meaning, example; more = + translation, type. */
export function defaultMapping(columns: number): Mapping {
  return {
    term: columns >= 1 ? 0 : null,
    meaning: columns >= 2 ? 1 : null,
    example_sentence: columns >= 3 ? 2 : null,
    example_translation: columns >= 4 ? 3 : null,
    type: columns >= 5 ? 4 : null,
  };
}

const KOREAN_TYPES: Record<string, WordType> = {
  명사: "noun",
  동사: "verb",
  형용사: "adjective",
  부사: "adverb",
  대명사: "pronoun",
  수사: "numeral",
  관형사: "determiner",
  조사: "particle",
  감탄사: "interjection",
  표현: "expression",
  의존명사: "noun",
  단위명사: "counter",
};
const ALIASES: Record<string, WordType> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
  pron: "pronoun",
  num: "numeral",
  det: "determiner",
  part: "particle",
  interj: "interjection",
  expr: "expression",
  phrase: "expression",
};

/** English names, Korean names (명사 …), common abbreviations; unknown → `other`. */
export function mapType(value: string | null | undefined): WordType {
  const v = (value ?? "").normalize("NFC").trim().toLowerCase().replace(/\.$/, "");
  if (!v) return "other";
  if ((WORD_TYPES as readonly string[]).includes(v)) return v as WordType;
  if (v.endsWith("s") && (WORD_TYPES as readonly string[]).includes(v.slice(0, -1))) {
    return v.slice(0, -1) as WordType;
  }
  return KOREAN_TYPES[v] ?? ALIASES[v] ?? "other";
}

export function splitMeanings(value: string, split: MeaningSplit): string[] {
  const seps = [split.semicolon && ";", split.comma && ",", split.slash && "/"].filter(
    Boolean,
  ) as string[];
  let parts = [value];
  for (const sep of seps) parts = parts.flatMap((p) => p.split(sep));
  return dedupeMeanings(parts);
}

/** One editable row of the import preview (CSV and photo import). */
export type ImportRow = {
  /** Stable row id (position in the source). */
  i: number;
  term: string;
  meanings: string[];
  exampleSentence: string | null;
  exampleTranslation: string | null;
  type: WordType;
  /** Photo import: unclear handwriting / conjugated form. */
  confidence?: "high" | "low";
};

export function buildRows(
  table: string[][],
  mapping: Mapping,
  opts: { header: boolean; split: MeaningSplit },
): ImportRow[] {
  const body = opts.header ? table.slice(1) : table;
  const cell = (r: string[], f: ImportField) => {
    const idx = mapping[f];
    return idx === null ? "" : (r[idx] ?? "");
  };
  return body.map((r, i) => ({
    i,
    term: clean(cell(r, "term")),
    meanings: splitMeanings(cell(r, "meaning"), opts.split),
    exampleSentence: cleanOrNull(cell(r, "example_sentence")),
    exampleTranslation: cleanOrNull(cell(r, "example_translation")),
    type: mapType(cell(r, "type")),
  }));
}

export type RowStatus = "new" | "duplicate" | "invalid";

export type ClassifiedRow = ImportRow & {
  status: RowStatus;
  /** Duplicate of a word already in the bank (vs. earlier row of the same file). */
  inBank: boolean;
  missingExample: boolean;
};

export function isRowValid(r: ImportRow): boolean {
  return (
    r.term.length > 0 &&
    r.term.length <= 200 &&
    r.meanings.length > 0 &&
    r.meanings.every((m) => m.length <= 200)
  );
}

export function rowKey(r: Pick<ImportRow, "term" | "meanings">): string | null {
  return r.meanings.length ? wordKey(r.term, r.meanings[0]) : null;
}

/**
 * Status per row: `invalid` (missing term or meaning), `duplicate` (same term + primary
 * meaning in the bank — `existing` keys — or earlier in the file), else `new`.
 */
export function classifyRows(rows: ImportRow[], existing: Set<string>): ClassifiedRow[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const missingExample = r.exampleSentence === null;
    if (!isRowValid(r)) return { ...r, status: "invalid", inBank: false, missingExample };
    const key = rowKey(r)!;
    const inBank = existing.has(key);
    const dup = inBank || seen.has(key);
    seen.add(key);
    return { ...r, status: dup ? "duplicate" : "new", inBank, missingExample };
  });
}

/**
 * Rows to send to the server: new rows, plus duplicates of bank words when
 * "update existing" is on (in-file duplicates are always skipped).
 */
export function rowsToImport(rows: ClassifiedRow[], updateExisting: boolean): ClassifiedRow[] {
  return rows.filter(
    (r) => r.status === "new" || (updateExisting && r.status === "duplicate" && r.inBank),
  );
}

export function countByStatus(rows: ClassifiedRow[]) {
  return {
    new: rows.filter((r) => r.status === "new").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    missingExample: rows.filter((r) => r.status !== "invalid" && r.missingExample).length,
  };
}
