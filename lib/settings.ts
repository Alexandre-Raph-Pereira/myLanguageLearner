import { eq } from "drizzle-orm";
import { userSettings, type UserSettings } from "@/db/schema";
import type { Db } from "@/db/types";

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
    createdAt: now,
    updatedAt: now,
  };
}
