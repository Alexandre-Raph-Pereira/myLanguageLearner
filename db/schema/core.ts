import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  nativeLanguage: text("native_language").notNull().default("en"),
  activeLanguage: text("active_language").notNull().default("ko"),
  aiProvider: text("ai_provider"),
  aiModelSmart: text("ai_model_smart"),
  aiModelFast: text("ai_model_fast"),
  budgetPerRequestUsd: numeric("budget_per_request_usd", {
    precision: 10,
    scale: 4,
    mode: "number",
  })
    .notNull()
    .default(0.5),
  budgetMonthlyUsd: numeric("budget_monthly_usd", { precision: 10, scale: 2, mode: "number" })
    .notNull()
    .default(10),
  ...timestamps,
});

export const languageProfiles = pgTable(
  "language_profiles",
  {
    userId: uuid("user_id").notNull(),
    language: text("language").notNull(),
    exam: text("exam").notNull().default("TOPIK"),
    targetLevel: smallint("target_level"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.language] })],
);

/** Global reference table (prices are not per user). */
export const modelPricing = pgTable("model_pricing", {
  modelId: text("model_id").primaryKey(),
  inputPerMtok: numeric("input_per_mtok", { precision: 10, scale: 4, mode: "number" }).notNull(),
  outputPerMtok: numeric("output_per_mtok", { precision: 10, scale: 4, mode: "number" }).notNull(),
  cacheReadPerMtok: numeric("cache_read_per_mtok", { precision: 10, scale: 4, mode: "number" }),
  verified: boolean("verified").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    task: text("task").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }).notNull().default(0),
    status: text("status", { enum: ["ok", "error", "blocked"] }).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

export type UserSettings = typeof userSettings.$inferSelect;
export type LanguageProfile = typeof languageProfiles.$inferSelect;
export type ModelPricing = typeof modelPricing.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
