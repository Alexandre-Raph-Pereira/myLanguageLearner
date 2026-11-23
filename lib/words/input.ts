import { z } from "zod";
import { WORD_TYPES, type WordType } from "@/db/schema/words";
import { clean, cleanOrNull, meaningKey } from "@/lib/text/normalize";

const optional = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => cleanOrNull(v));

/** A word as entered in the form or produced by an import (validated + NFC-cleaned). */
export const wordInput = z.object({
  term: z
    .string()
    .transform(clean)
    .pipe(z.string().min(1, "Term is required").max(200, "Term is too long")),
  meanings: z
    .array(z.string())
    .transform((list) => dedupeMeanings(list))
    .pipe(
      z
        .array(z.string().max(200, "Meaning is too long"))
        .min(1, "At least one meaning is required")
        .max(20, "Too many meanings"),
    ),
  type: z.enum(WORD_TYPES).default("other"),
  exampleSentence: optional(1000),
  exampleTranslation: optional(1000),
  notes: optional(2000),
});
export type WordInput = z.infer<typeof wordInput>;

/** Cleaned, non-empty meanings without duplicates (by normalized key), order kept. */
export function dedupeMeanings(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const m = clean(raw);
    const key = meaningKey(m);
    if (!m || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export function isWordType(v: unknown): v is WordType {
  return typeof v === "string" && (WORD_TYPES as readonly string[]).includes(v);
}

/** Key used for duplicate detection: exact (cleaned) term + normalized primary meaning. */
export function wordKey(term: string, primaryMeaning: string): string {
  return `${clean(term)}\u0000${meaningKey(primaryMeaning)}`;
}
