import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { contentSource, contentStatus } from "./enums";

export const WORD_TYPES = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "numeral",
  "determiner",
  "particle",
  "counter",
  "interjection",
  "expression",
  "other",
] as const;
export type WordType = (typeof WORD_TYPES)[number];
export const wordType = pgEnum("word_type", WORD_TYPES);

export const words = pgTable(
  "words",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    /** Dictionary form, NFC. */
    term: text("term").notNull(),
    /** Accepted answers; the first one is the primary meaning. */
    meanings: text("meanings").array().notNull(),
    /** Normalized primary meaning (uniqueness: homonyms are allowed). */
    meaningKey: text("meaning_key").notNull(),
    type: wordType("type").notNull().default("other"),
    exampleSentence: text("example_sentence"),
    exampleTranslation: text("example_translation"),
    notes: text("notes"),
    level: smallint("level").notNull().default(0),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    correctStreak: integer("correct_streak").notNull().default(0),
    timesCorrect: integer("times_correct").notNull().default(0),
    timesFailed: integer("times_failed").notNull().default(0),
    timesLookedUp: integer("times_looked_up").notNull().default(0),
    status: contentStatus("status").notNull().default("active"),
    source: contentSource("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("words_user_lang_term_meaning_uq").on(
      t.userId,
      t.language,
      t.term,
      t.meaningKey,
    ),
    index("words_user_lang_term_idx").on(t.userId, t.language, t.term),
    index("words_user_lang_due_idx").on(t.userId, t.language, t.dueAt),
    check("words_level_range", sql`${t.level} between 0 and 3`),
    check("words_meanings_nonempty", sql`cardinality(${t.meanings}) >= 1`),
  ],
);

export const TEST_KINDS = ["word", "grammar", "topik"] as const;
export const SESSION_STATUSES = [
  "generating",
  "ready",
  "in_progress",
  "finished",
  "abandoned",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Generic test session (reused by plans 03–05). */
export const testSessions = pgTable(
  "test_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    kind: text("kind", { enum: TEST_KINDS }).notNull(),
    /** `blank | serious` for TOPIK. */
    mode: text("mode"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status", { enum: SESSION_STATUSES }).notNull().default("ready"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    timeLimitS: integer("time_limit_s"),
    scoreCorrect: integer("score_correct").notNull().default(0),
    scoreTotal: integer("score_total").notNull().default(0),
  },
  (t) => [index("test_sessions_user_kind_idx").on(t.userId, t.kind, t.startedAt)],
);

export const DIRECTIONS = ["en_ko", "ko_en"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const REVIEW_RESULTS = ["correct", "wrong", "alternative", "override"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

export const wordReviews = pgTable(
  "word_reviews",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    sessionId: uuid("session_id").references(() => testSessions.id, { onDelete: "cascade" }),
    wordId: uuid("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: DIRECTIONS }).notNull(),
    answer: text("answer").notNull(),
    result: text("result", { enum: REVIEW_RESULTS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("word_reviews_session_idx").on(t.sessionId),
    index("word_reviews_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export type Word = typeof words.$inferSelect;
export type NewWord = typeof words.$inferInsert;
export type TestSession = typeof testSessions.$inferSelect;
export type WordReview = typeof wordReviews.$inferSelect;
