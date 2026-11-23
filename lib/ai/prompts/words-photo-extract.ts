import { WORD_TYPES } from "@/db/schema/words";
import { LANGUAGE_LABELS, type Language } from "@/lib/languages";

/** Task `words.photo_extract`: transcribe a vocabulary notebook page (smart tier, vision). */
export function photoExtractPrompt(language: Language): { system: string; prompt: string } {
  const lang = LANGUAGE_LABELS[language].english;
  return {
    system: [
      `You transcribe a photo of a learner's handwritten ${lang} vocabulary notebook into structured entries.`,
      "Rules:",
      "- Transcribe exactly what is written. Do not invent words, meanings or example sentences that are not on the page.",
      `- ${lang} text in Unicode NFC. Meanings in English as written (split several meanings into separate strings).`,
      "- One entry per vocabulary item. Include an example sentence / translation only when written next to the item.",
      '- Mark an entry `confidence: "low"` when the handwriting is unclear or when a verb/adjective is written in a conjugated form (keep it as written).',
      "- Skip crossed-out items, page titles, dates and doodles.",
      `- \`type\` only when written or obvious from the page; allowed: ${WORD_TYPES.join(", ")}.`,
      "- If the page has no vocabulary, return an empty list.",
    ].join("\n"),
    prompt: "Transcribe the vocabulary entries on this page.",
  };
}
