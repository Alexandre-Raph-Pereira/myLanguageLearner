import type { PricingRates } from "./pricing";

/** Tokens charged per attached image (rough upper bound for a phone photo). */
export const IMAGE_TOKENS = 1_600;
const LATIN_CHARS_PER_TOKEN = 3.5;
// Hangul (jamo, compatibility jamo, syllables), CJK ideographs, kana, fullwidth forms.
const CJK_RE =
  /[\u1100-\u11ff\u3040-\u30ff\u3130-\u318f\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/u;

/**
 * Rough, deliberately upper-biased input token estimate used for budget checks
 * *before* a call: each Hangul/CJK char counts as 1 token, other chars as
 * 1/3.5 token, and each image as 1,600 tokens. Real usage is logged afterwards.
 */
export function estimateInputTokens({ text, images = 0 }: { text: string; images?: number }) {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjk++;
    else other++;
  }
  return Math.ceil(cjk + other / LATIN_CHARS_PER_TOKEN + images * IMAGE_TOKENS);
}

/** Upper-bound cost (USD) assuming the model uses all of maxOutputTokens. */
export function estimateCost(inputTokens: number, maxOutputTokens: number, pricing: PricingRates) {
  return (inputTokens * pricing.inputPerMtok + maxOutputTokens * pricing.outputPerMtok) / 1_000_000;
}
