import { describe, expect, it } from "vitest";
import { goalPercent, isGoalMet } from "./goal";

describe("goal", () => {
  it("averages the capped halves", () => {
    expect(goalPercent({ words: 14, lessons: 1, goalWords: 20, goalLessons: 1 })).toBeCloseTo(85);
    expect(goalPercent({ words: 40, lessons: 0, goalWords: 20, goalLessons: 1 })).toBe(50);
    expect(goalPercent({ words: 0, lessons: 0, goalWords: 20, goalLessons: 1 })).toBe(0);
  });

  it("goalLessons 0 → the grammar half counts as met", () => {
    expect(goalPercent({ words: 10, lessons: 0, goalWords: 20, goalLessons: 0 })).toBe(75);
    expect(isGoalMet({ words: 20, lessons: 0, goalWords: 20, goalLessons: 0 })).toBe(true);
  });

  it("isGoalMet needs both halves", () => {
    expect(isGoalMet({ words: 20, lessons: 1, goalWords: 20, goalLessons: 1 })).toBe(true);
    expect(isGoalMet({ words: 25, lessons: 0, goalWords: 20, goalLessons: 1 })).toBe(false);
    expect(isGoalMet({ words: 19, lessons: 3, goalWords: 20, goalLessons: 1 })).toBe(false);
  });
});
