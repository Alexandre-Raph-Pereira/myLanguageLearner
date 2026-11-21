import { eq } from "drizzle-orm";
import { modelPricing } from "@/db/schema";
import type { Db } from "@/db/types";

export type PricingRates = {
  inputPerMtok: number;
  outputPerMtok: number;
  cacheReadPerMtok: number | null;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Subset of inputTokens read from the prompt cache. */
  cachedInputTokens: number;
};

/** Pricing row for a model, or null when unknown (calls are then blocked). */
export async function getPricing(db: Db, modelId: string) {
  const [row] = await db.select().from(modelPricing).where(eq(modelPricing.modelId, modelId));
  return row ?? null;
}

/** Real cost in USD. Cached input is billed at the cache-read rate when known. */
export function costOf(usage: TokenUsage, pricing: PricingRates): number {
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const uncached = usage.inputTokens - cached;
  const cacheRate = pricing.cacheReadPerMtok ?? pricing.inputPerMtok;
  return (
    (uncached * pricing.inputPerMtok +
      cached * cacheRate +
      usage.outputTokens * pricing.outputPerMtok) /
    1_000_000
  );
}
