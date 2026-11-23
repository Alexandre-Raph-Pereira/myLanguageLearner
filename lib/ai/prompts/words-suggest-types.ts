import type { Language } from "@/lib/languages";
import { LANGUAGE_LABELS } from "@/lib/languages";
import { WORD_TYPES } from "@/db/schema/words";

/** Task `words.suggest_types`: part of speech for imported words (fast tier). */
export function suggestTypesPrompt(
  language: Language,
  rows: { i: number; term: string; meaning: string }[],
): { system: string; prompt: string } {
  const lang = LANGUAGE_LABELS[language].english;
  return {
    system: [
      `You classify ${lang} vocabulary items by part of speech for a learner's word bank.`,
      `Allowed types: ${WORD_TYPES.join(", ")}.`,
      "Rules:",
      "- Use the dictionary form and its English meaning to decide.",
      `- ${lang === "Korean" ? "Korean descriptive verbs (e.g. 크다 'big') are 'adjective'; 하다-verbs are 'verb'; counters (개, 명, 마리) are 'counter'; particles (은/는, 이/가) are 'particle'." : "Use the usual part of speech of the dictionary form."}`,
      "- Multi-word phrases, set expressions and greetings are 'expression'.",
      "- When unsure, answer 'other'. Never invent items.",
      "- Return exactly one entry per input item, with the same `i`.",
    ].join("\n"),
    prompt: `Items (JSON lines, i = id):\n${rows
      .map((r) => JSON.stringify({ i: r.i, term: r.term, meaning: r.meaning }))
      .join("\n")}`,
  };
}
