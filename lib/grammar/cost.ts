/** Client-safe cost estimate for grammar AI calls (shown before each call). */
import { estimateCost, estimateInputTokens } from "@/lib/ai/estimate";

/**
 * Smart model rates + token size of the fixed part of each prompt (computed server-side);
 * the variable part (notes, image, draft) is added here. `rates: null` = no price (blocked).
 */
export type GrammarCostInfo = {
  model: string;
  rates: { inputPerMtok: number; outputPerMtok: number } | null;
  structureBaseTokens: number;
  rewriteBaseTokens: number;
  structureMaxOutput: number;
  rewriteMaxOutput: number;
};

/** Upper bound (USD) of one `grammar.structure` call, or null without a price. */
export function structureEstimate(
  info: GrammarCostInfo,
  input: { notes?: string; images?: number },
): number | null {
  if (!info.rates) return null;
  const tokens =
    info.structureBaseTokens +
    estimateInputTokens({ text: input.notes ?? "", images: input.images ?? 0 });
  return estimateCost(tokens, info.structureMaxOutput, { ...info.rates, cacheReadPerMtok: null });
}

/** Upper bound (USD) of one `grammar.rewrite` call for this draft JSON + instruction. */
export function rewriteEstimate(
  info: GrammarCostInfo,
  draftJson: string,
  instruction: string,
): number | null {
  if (!info.rates) return null;
  const tokens =
    info.rewriteBaseTokens + estimateInputTokens({ text: `${draftJson}\n${instruction}` });
  return estimateCost(tokens, info.rewriteMaxOutput, { ...info.rates, cacheReadPerMtok: null });
}

/** "≈ $0.03" (at least $0.01 shown as "< $0.01"); a hint when the model has no price. */
export function formatEstimate(usd: number | null): string {
  if (usd === null) return "no price set for the model";
  if (usd < 0.01) return "≈ < $0.01";
  return `≈ $${usd.toFixed(2)}`;
}
