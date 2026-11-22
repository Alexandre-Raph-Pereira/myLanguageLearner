import { describe, expect, it } from "vitest";
import { evaluate, MILESTONES, MILESTONES_BY_ID, nextMilestone } from "./milestones";

describe("milestones catalog", () => {
  it("has the 24 milestones with unique ids", () => {
    expect(MILESTONES).toHaveLength(24);
    expect(MILESTONES_BY_ID.size).toBe(24);
    const groups = MILESTONES.reduce<Record<string, number>>((acc, m) => {
      acc[m.group] = (acc[m.group] ?? 0) + 1;
      return acc;
    }, {});
    expect(groups).toEqual({ words: 8, grammar: 5, streak: 4, coverage: 6, topik: 1 });
    expect(MILESTONES_BY_ID.get("words-1000")?.label).toBe("1,000 words known");
  });
});

describe("evaluate", () => {
  it("missing sources → null progress, never earned", () => {
    const e = evaluate({});
    expect(e.earned).toEqual([]);
    expect(Object.values(e.progress).every((p) => p === null)).toBe(true);
  });

  it("only the sources that exist are evaluated", () => {
    const e = evaluate({ streak: 8, wordsKnown: null });
    expect(e.earned).toEqual(["streak-7"]);
    expect(e.progress["streak-30"]).toBeCloseTo((8 / 30) * 100);
    expect(e.progress["words-50"]).toBeNull();
    expect(e.progress["coverage-1"]).toBeNull();
  });

  it("words, grammar, coverage and TOPIK", () => {
    const e = evaluate({
      wordsKnown: 120,
      grammarMastered: 5,
      coverageByLevel: { 1: 100, 2: 64 },
      bestSeriousTopik: 72,
    });
    expect(e.earned).toEqual(
      expect.arrayContaining([
        "words-50",
        "words-100",
        "grammar-5",
        "coverage-1",
        "topik-serious-70",
      ]),
    );
    expect(e.earned).not.toContain("words-250");
    expect(e.progress["words-250"]).toBeCloseTo(48);
    expect(e.progress["coverage-2"]).toBe(64);
    expect(e.progress["coverage-3"]).toBeNull();
    expect(e.progress["words-2000"]).toBeCloseTo(6);
  });

  it("clamps progress at 0–100", () => {
    const e = evaluate({ wordsKnown: -3, bestSeriousTopik: 95 });
    expect(e.progress["words-50"]).toBe(0);
    expect(e.progress["topik-serious-70"]).toBe(100);
  });
});

describe("nextMilestone", () => {
  it("picks the locked milestone closest to completion", () => {
    const e = evaluate({ wordsKnown: 120, streak: 2 });
    expect(nextMilestone(e)).toEqual({
      milestone: MILESTONES_BY_ID.get("words-250"),
      pct: 48,
    });
  });

  it("skips milestones earned earlier", () => {
    const e = evaluate({ streak: 3 });
    expect(nextMilestone(e, ["streak-7"])?.milestone.id).toBe("streak-30");
  });

  it("null when nothing is measurable", () => {
    expect(nextMilestone(evaluate({}))).toBeNull();
  });
});
