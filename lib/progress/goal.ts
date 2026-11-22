import { goalPercent as scaleGoalPercent } from "./scale";

export type GoalCounts = {
  words: number;
  lessons: number;
  goalWords: number;
  /** 0 → the grammar half counts as met. */
  goalLessons: number;
};

/** Daily goal % (0–100, unrounded): average of the capped word and lesson ratios. */
export function goalPercent(c: GoalCounts): number {
  return scaleGoalPercent(
    { done: c.words, goal: c.goalWords },
    { done: c.lessons, goal: c.goalLessons },
  );
}

/** Goal fully met (both halves). */
export function isGoalMet(c: GoalCounts): boolean {
  return goalPercent(c) >= 100;
}
