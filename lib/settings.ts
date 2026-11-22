import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  aiUsage,
  languageProfiles,
  modelPricing,
  userSettings,
  type LanguageProfile,
  type UserSettings,
} from "@/db/schema";
import type { Db } from "@/db/types";
import { LANGUAGE_EXAMS, SUPPORTED_LANGUAGES, type Language } from "@/lib/languages";

export const DEFAULT_BUDGET_PER_REQUEST_USD = 0.5;
export const DEFAULT_BUDGET_MONTHLY_USD = 10;

/** The user's settings row, or defaults when it does not exist yet. */
export async function getUserSettings(db: Db, userId: string): Promise<UserSettings> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (row) return row;
  const now = new Date();
  return {
    userId,
    nativeLanguage: "en",
    activeLanguage: "ko",
    aiProvider: null,
    aiModelSmart: null,
    aiModelFast: null,
    budgetPerRequestUsd: DEFAULT_BUDGET_PER_REQUEST_USD,
    budgetMonthlyUsd: DEFAULT_BUDGET_MONTHLY_USD,
    timezone: "UTC",
    showPoints: true,
    celebrateMilestones: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getLanguageProfile(
  db: Db,
  userId: string,
  language: Language,
): Promise<LanguageProfile | null> {
  const [row] = await db
    .select()
    .from(languageProfiles)
    .where(and(eq(languageProfiles.userId, userId), eq(languageProfiles.language, language)));
  return row ?? null;
}

// ---- input schemas (shared by server actions and tests) ----

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? null : v));

export const languageProfileInput = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  // "" (no selection) → null
  targetLevel: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(1).max(6).nullable(),
  ),
});

export const aiSettingsInput = z.object({
  aiProvider: z.enum(["", "anthropic", "openai", "google"]).transform((v) => (v === "" ? null : v)),
  aiModelSmart: optionalText,
  aiModelFast: optionalText,
});

export const budgetsInput = z.object({
  budgetPerRequestUsd: z.coerce.number().positive().max(100),
  budgetMonthlyUsd: z.coerce.number().positive().max(10_000),
});

export const pricingInput = z.object({
  modelId: z.string().trim().min(1).max(200),
  inputPerMtok: z.coerce.number().min(0).max(1000),
  outputPerMtok: z.coerce.number().min(0).max(1000),
  cacheReadPerMtok: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(1000).nullable(),
  ),
});

// ---- writes (always scoped by userId, except the global pricing table) ----

export async function saveLanguageProfile(
  db: Db,
  userId: string,
  input: z.infer<typeof languageProfileInput>,
) {
  await db
    .insert(languageProfiles)
    .values({
      userId,
      language: input.language,
      exam: LANGUAGE_EXAMS[input.language] ?? "TOPIK",
      targetLevel: input.targetLevel,
    })
    .onConflictDoUpdate({
      target: [languageProfiles.userId, languageProfiles.language],
      set: { targetLevel: input.targetLevel, updatedAt: new Date() },
    });
}

export async function saveAiSettings(
  db: Db,
  userId: string,
  input: z.infer<typeof aiSettingsInput>,
) {
  await db
    .insert(userSettings)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...input, updatedAt: new Date() } });
}

export async function saveBudgets(db: Db, userId: string, input: z.infer<typeof budgetsInput>) {
  await db
    .insert(userSettings)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: userSettings.userId, set: { ...input, updatedAt: new Date() } });
}

/** Saving from the UI marks the prices as verified by the owner. */
export async function savePricing(db: Db, input: z.infer<typeof pricingInput>) {
  const values = { ...input, verified: true, updatedAt: new Date() };
  await db
    .insert(modelPricing)
    .values(values)
    .onConflictDoUpdate({ target: modelPricing.modelId, set: values });
}

// ---- reads for the settings page ----

export async function getPricingRows(db: Db, modelIds: string[]) {
  if (modelIds.length === 0) return [];
  return db.select().from(modelPricing).where(inArray(modelPricing.modelId, modelIds));
}

export async function recentUsage(db: Db, userId: string, limit = 20) {
  return db
    .select()
    .from(aiUsage)
    .where(eq(aiUsage.userId, userId))
    .orderBy(desc(aiUsage.createdAt))
    .limit(limit);
}
