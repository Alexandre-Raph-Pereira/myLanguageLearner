import { z } from "zod";
import { CONTENT_SOURCES } from "@/db/schema/enums";
import { GRAMMAR_LINK_KINDS } from "@/db/schema/grammar";
import { clean } from "@/lib/text/normalize";

/**
 * `GrammarDraft`: a lesson as produced by the AI (`grammar.structure`, `grammar.rewrite`).
 * `related[].ref` is a short code of an existing lesson (`G1`…`Gn`) mapped back to ids server-side.
 * Kept loose on purpose (no min/max): the model's JSON is validated here, the
 * stricter rules are applied on save by `grammarInput`.
 */
export const grammarDraftSchema = z.object({
  title: z.string(),
  pattern: z.string(),
  variants: z.array(z.string()),
  meaning_short: z.string(),
  level: z.number().int().min(1).max(6).nullable(),
  description_md: z.string(),
  formation_md: z.string(),
  examples: z.array(z.object({ sentence: z.string(), translation: z.string() })),
  similar_md: z.string(),
  related: z.array(
    z.object({
      ref: z.string(),
      kind: z.enum(GRAMMAR_LINK_KINDS),
      note: z.string().nullish(),
    }),
  ),
});
export type GrammarDraft = z.infer<typeof grammarDraftSchema>;

export const structureOutputSchema = z.object({ drafts: z.array(grammarDraftSchema) });

/** A related lesson as edited in the review form (resolved to an id). */
export type RelatedLesson = {
  id: string;
  title: string;
  kind: (typeof GRAMMAR_LINK_KINDS)[number];
  note?: string | null;
};

/** Draft as held by the review UI: AI fields with `related` resolved to existing lessons. */
export type ReviewDraft = Omit<GrammarDraft, "related"> & { related: RelatedLesson[] };

/** A review draft sent back by the client (rewrite requests). */
export const reviewDraftSchema = grammarDraftSchema.omit({ related: true }).extend({
  related: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string().max(200),
        kind: z.enum(GRAMMAR_LINK_KINDS),
        note: z.string().max(300).nullish(),
      }),
    )
    .max(30),
});

export function emptyDraft(): ReviewDraft {
  return {
    title: "",
    pattern: "",
    variants: [],
    meaning_short: "",
    level: null,
    description_md: "",
    formation_md: "",
    examples: [
      { sentence: "", translation: "" },
      { sentence: "", translation: "" },
    ],
    similar_md: "",
    related: [],
  };
}

/** Markdown: NFC + trimmed, inner whitespace kept. */
const md = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v ?? "").normalize("NFC").trim());

const line = (label: string, max: number) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} is too long`));

/** Lesson as saved (validated + NFC-cleaned). */
export const grammarInput = z.object({
  title: line("Title", 200),
  pattern: line("Pattern", 200),
  variants: z
    .array(z.string())
    .max(40, "Too many variants")
    .transform((list) => {
      const out: string[] = [];
      for (const v of list.map(clean)) if (v && !out.includes(v)) out.push(v);
      return out;
    }),
  meaning_short: line("Meaning", 300),
  level: z.coerce
    .number()
    .int()
    .min(1)
    .max(6)
    .nullish()
    .transform((v) => v ?? null),
  description_md: md(10_000),
  formation_md: md(10_000),
  examples: z
    .array(z.object({ sentence: z.string(), translation: z.string() }))
    .transform((list) =>
      list
        .map((e) => ({ sentence: clean(e.sentence), translation: clean(e.translation) }))
        .filter((e) => e.sentence !== ""),
    )
    .pipe(
      z
        .array(z.object({ sentence: z.string().max(1000), translation: z.string().max(1000) }))
        .min(2, "Add at least 2 examples")
        .max(30, "Too many examples"),
    ),
  similar_md: md(10_000),
  related: z
    .array(
      z.object({
        id: z.uuid(),
        kind: z.enum(GRAMMAR_LINK_KINDS),
        note: z
          .string()
          .max(300)
          .nullish()
          .transform((v) => (v ? clean(v) || null : null)),
      }),
    )
    .max(30)
    .default([]),
});
export type GrammarInput = z.infer<typeof grammarInput>;
export type GrammarInputRaw = z.input<typeof grammarInput>;

export const grammarSourceSchema = z.enum(CONTENT_SOURCES);
