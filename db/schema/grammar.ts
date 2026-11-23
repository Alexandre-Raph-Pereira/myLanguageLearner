import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { contentSource, contentStatus } from "./enums";

/** One example sentence in the target language with its translation (native language). */
export type GrammarExample = { sentence: string; translation: string };

export const grammarPoints = pgTable(
  "grammar_points",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    /** e.g. `-(으)ㄹ 수 있다` (NFC). */
    title: text("title").notNull(),
    /** Canonical form. */
    pattern: text("pattern").notNull(),
    /** Surface forms used for matching / annotation. */
    variants: text("variants")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** `normPattern` of pattern + variants (computed on save). */
    matchKeys: text("match_keys")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    meaningShort: text("meaning_short").notNull(),
    /** Estimated TOPIK level 1–6. */
    level: smallint("level"),
    descriptionMd: text("description_md").notNull().default(""),
    formationMd: text("formation_md").notNull().default(""),
    examples: jsonb("examples").$type<GrammarExample[]>().notNull().default([]),
    similarMd: text("similar_md").notNull().default(""),
    status: contentStatus("status").notNull().default("active"),
    source: contentSource("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("grammar_points_user_lang_idx").on(t.userId, t.language),
    index("grammar_points_match_keys_idx").using("gin", t.matchKeys),
    check("grammar_points_level_range", sql`${t.level} is null or ${t.level} between 1 and 6`),
  ],
);

export const GRAMMAR_LINK_KINDS = ["similar", "contrast", "prerequisite"] as const;
export type GrammarLinkKind = (typeof GRAMMAR_LINK_KINDS)[number];

/** Links between lessons; both directions are stored. */
export const grammarLinks = pgTable(
  "grammar_links",
  {
    userId: uuid("user_id").notNull(),
    grammarId: uuid("grammar_id")
      .notNull()
      .references(() => grammarPoints.id, { onDelete: "cascade" }),
    relatedId: uuid("related_id")
      .notNull()
      .references(() => grammarPoints.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: GRAMMAR_LINK_KINDS }).notNull(),
    note: text("note"),
  },
  (t) => [
    primaryKey({ columns: [t.grammarId, t.relatedId] }),
    index("grammar_links_user_idx").on(t.userId),
    index("grammar_links_related_idx").on(t.relatedId),
    check("grammar_links_not_self", sql`${t.grammarId} <> ${t.relatedId}`),
  ],
);

export type GrammarPoint = typeof grammarPoints.$inferSelect;
export type NewGrammarPoint = typeof grammarPoints.$inferInsert;
export type GrammarLink = typeof grammarLinks.$inferSelect;
