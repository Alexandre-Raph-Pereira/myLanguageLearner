import { describe, expect, it } from "vitest";
import {
  clampPct,
  goalPercent,
  levelStep,
  masteryStep,
  scaleStep,
  stepClasses,
  stepVar,
} from "./scale";

describe("scaleStep", () => {
  it.each([
    [0, 0],
    [39.9, 0],
    [40, 1],
    [59, 1],
    [59.99, 1],
    [60, 2],
    [79, 2],
    [80, 3],
    [100, 3],
    [150, 3],
    [-5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("%s%% → step %s", (pct, step) => {
    expect(scaleStep(pct)).toBe(step);
  });
});

describe("levelStep", () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [-1, 0],
    [Number.NaN, 0],
  ])("level %s → step %s", (level, step) => {
    expect(levelStep(level)).toBe(step);
  });
});

describe("masteryStep", () => {
  it("maps grammar mastery states", () => {
    expect(masteryStep("not_tested", 90)).toBe("muted");
    expect(masteryStep("learning", 45)).toBe(1);
    expect(masteryStep("learning", 85)).toBe(3);
    expect(masteryStep("mastered", 10)).toBe(3);
  });
});

describe("stepClasses", () => {
  it("returns the token classes of each step", () => {
    expect(stepClasses(2)).toEqual({
      fill: "bg-level-2",
      text: "text-level-2-text",
      onFill: "text-on-level-2",
      soft: "bg-level-2/15",
    });
    expect(stepClasses("muted").text).toBe("text-muted-foreground");
    expect(stepVar(0)).toBe("var(--level-0)");
  });
});

describe("helpers", () => {
  it("clampPct", () => {
    expect(clampPct(84.6)).toBe(85);
    expect(clampPct(-3)).toBe(0);
    expect(clampPct(120)).toBe(100);
    expect(clampPct(Number.NaN)).toBe(0);
  });

  it("goalPercent averages capped ratios", () => {
    expect(goalPercent({ done: 14, goal: 20 }, { done: 1, goal: 1 })).toBeCloseTo(85);
    expect(goalPercent({ done: 40, goal: 20 }, { done: 0, goal: 1 })).toBe(50);
    expect(goalPercent({ done: 0, goal: 20 }, { done: 0, goal: 1 })).toBe(0);
  });
});
