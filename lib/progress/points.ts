import type { ActivityKind } from "@/db/schema/progress";

/** Points table (docs/DESIGN.md §4). Wrong answers give 0. */
export const POINTS = {
  wordCorrect: 10,
  wordKnown: 5,
  grammarCredit: 10,
  grammarCorrect: 10,
  grammarTranslation: 15,
  topikBlank: 15,
  topikSerious: 20,
  goalMet: 25,
  milestone: 0,
} as const;

/**
 * What callers put in `meta` so the default points can be derived:
 * - `correct`: answer was right (word / grammar / TOPIK). Word "alternative" and "I was right" count as correct.
 * - `questionType`: grammar question type; `"translation"` is worth more.
 * - `mode`: TOPIK test mode (`"blank"` | `"serious"`).
 */
export type PointsMeta = {
  correct?: boolean;
  questionType?: string;
  mode?: "blank" | "serious";
};

export function pointsFor(event: { kind: ActivityKind; meta?: PointsMeta | null }): number {
  const meta = event.meta ?? {};
  switch (event.kind) {
    case "word_answer":
      return meta.correct ? POINTS.wordCorrect : 0;
    case "word_known":
      return POINTS.wordKnown;
    case "grammar_credit":
      return POINTS.grammarCredit;
    case "grammar_answer":
      if (!meta.correct) return 0;
      return meta.questionType === "translation"
        ? POINTS.grammarTranslation
        : POINTS.grammarCorrect;
    case "topik_answer":
      if (!meta.correct) return 0;
      return meta.mode === "serious" ? POINTS.topikSerious : POINTS.topikBlank;
    case "goal_met":
      return POINTS.goalMet;
    case "milestone":
      return POINTS.milestone;
  }
}
