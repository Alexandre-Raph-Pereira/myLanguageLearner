import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ACTIVITY_KINDS = [
  "word_answer",
  "word_known",
  "grammar_credit",
  "grammar_answer",
  "topik_answer",
  "goal_met",
  "milestone",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Append-only ledger of everything that awards progress (written only by recordActivity). */
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    kind: text("kind", { enum: ACTIVITY_KINDS }).notNull(),
    points: integer("points").notNull().default(0),
    refId: uuid("ref_id"),
    sessionId: uuid("session_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    /** Day in the user's timezone at insert time (YYYY-MM-DD). */
    localDate: date("local_date", { mode: "string" }).notNull(),
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_events_user_lang_date_idx").on(t.userId, t.language, t.localDate),
    uniqueIndex("activity_events_user_dedupe_uq")
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);

/** One row per user / language / local day, maintained in the same transaction as events. */
export const dailyProgress = pgTable(
  "daily_progress",
  {
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    localDate: date("local_date", { mode: "string" }).notNull(),
    wordsAnswered: integer("words_answered").notNull().default(0),
    grammarLessons: integer("grammar_lessons").notNull().default(0),
    points: integer("points").notNull().default(0),
    goalWords: smallint("goal_words").notNull(),
    goalGrammar: smallint("goal_grammar").notNull(),
    goalMet: boolean("goal_met").notNull().default(false),
    goalMetAt: timestamp("goal_met_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.language, t.localDate] })],
);

export const milestonesEarned = pgTable(
  "milestones_earned",
  {
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    milestoneId: text("milestone_id").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.language, t.milestoneId] })],
);

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type DailyProgress = typeof dailyProgress.$inferSelect;
export type MilestoneEarned = typeof milestonesEarned.$inferSelect;
