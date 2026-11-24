import "server-only";
import { z } from "zod";
import { WORD_TYPES, type WordType } from "@/db/schema/words";
import type { Db } from "@/db/types";
import { createOperation } from "@/lib/ai/budget";
import { estimateCost, estimateInputTokens } from "@/lib/ai/estimate";
import { getPricing } from "@/lib/ai/pricing";
import { suggestTypesPrompt } from "@/lib/ai/prompts/words-suggest-types";
import { isPlanProvider, resolveModelChoice } from "@/lib/ai/providers";
import { aiObject } from "@/lib/ai/run";
import { getUserSettings } from "@/lib/settings";
import type { Scope } from "./queries";

export const SUGGEST_TASK = "words.suggest_types";
export const SUGGEST_CHUNK = 200;
const OUTPUT_TOKENS_PER_ROW = 16;

export const suggestTypesSchema = z.object({
  types: z.array(z.object({ i: z.number().int(), type: z.enum(WORD_TYPES) })),
});

export type SuggestRow = { i: number; term: string; meaning: string };

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const maxOutput = (n: number) => 200 + n * OUTPUT_TOKENS_PER_ROW;

/** Upper-bound cost (USD) of suggesting types for these rows, or null when the model has no price. */
export async function estimateSuggestTypes(
  db: Db,
  s: Scope,
  rows: SuggestRow[],
): Promise<{ usd: number | null; calls: number; model: string; included: boolean }> {
  const settings = await getUserSettings(db, s.userId);
  const { modelId, provider } = resolveModelChoice("fast", settings);
  const parts = chunks(rows, SUGGEST_CHUNK);
  // Claude Code: included in the Claude plan, nothing to price.
  if (isPlanProvider(provider)) {
    return { usd: 0, calls: parts.length, model: modelId, included: true };
  }
  const pricing = await getPricing(db, modelId);
  if (!pricing) return { usd: null, calls: parts.length, model: modelId, included: false };
  let usd = 0;
  for (const part of parts) {
    const p = suggestTypesPrompt(s.language, part);
    usd += estimateCost(
      estimateInputTokens({ text: `${p.system}\n${p.prompt}` }),
      maxOutput(part.length),
      pricing,
    );
  }
  return { usd, calls: parts.length, model: modelId, included: false };
}

/** One operation, chunks of 200 rows (fast tier). Unknown ids in the answer are ignored. */
export async function suggestTypes(
  db: Db,
  s: Scope,
  rows: SuggestRow[],
): Promise<{ i: number; type: WordType }[]> {
  const operation = createOperation(s.userId, "words.suggest_types");
  const ids = new Set(rows.map((r) => r.i));
  const out = new Map<number, WordType>();
  for (const part of chunks(rows, SUGGEST_CHUNK)) {
    const p = suggestTypesPrompt(s.language, part);
    const res = await aiObject({
      db,
      userId: s.userId,
      operation,
      task: SUGGEST_TASK,
      tier: "fast",
      schema: suggestTypesSchema,
      system: p.system,
      prompt: p.prompt,
      maxOutputTokens: maxOutput(part.length),
      cacheSystem: true,
    });
    for (const t of res.types) if (ids.has(t.i)) out.set(t.i, t.type);
  }
  return [...out].map(([i, type]) => ({ i, type }));
}
