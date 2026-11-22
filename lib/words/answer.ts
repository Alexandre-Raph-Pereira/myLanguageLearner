import type { Direction } from "@/db/schema/words";
import type { Language } from "@/lib/languages";
import { normEn, normKo } from "@/lib/text/normalize";

/**
 * Directions: `en_ko` = native → target (user types the target-language term),
 * `ko_en` = target → native (user types a meaning). Names kept from the plan.
 */
export type { Direction };
export type CheckResult = "correct" | "wrong" | "alternative";

export type CheckableWord = { id: string; term: string; meanings: string[] };

/** Normalizer for target-language answers (Korean today; Latin-script languages later). */
export function normTarget(language: Language, s: string): string {
  return language === "ko" ? normKo(s) : normEn(s);
}

export function checkAnswer({
  word,
  direction,
  answer,
  bank = [],
  language = "ko",
}: {
  word: CheckableWord;
  direction: Direction;
  answer: string;
  /** Other active words of the bank (alternatives). */
  bank?: CheckableWord[];
  language?: Language;
}): { result: CheckResult; alternativeId?: string } {
  if (direction === "ko_en") {
    const given = normEn(answer);
    if (given && word.meanings.some((m) => normEn(m) === given)) return { result: "correct" };
    return { result: "wrong" };
  }
  const given = normTarget(language, answer);
  if (!given) return { result: "wrong" };
  if (given === normTarget(language, word.term)) return { result: "correct" };
  const meanings = new Set(word.meanings.map(normEn));
  const alt = bank.find(
    (b) =>
      b.id !== word.id &&
      normTarget(language, b.term) === given &&
      b.meanings.some((m) => meanings.has(normEn(m))),
  );
  return alt ? { result: "alternative", alternativeId: alt.id } : { result: "wrong" };
}
