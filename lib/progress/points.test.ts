import { describe, expect, it } from "vitest";
import { POINTS, pointsFor } from "./points";

describe("pointsFor", () => {
  it("word answers: 10 when correct, 0 when wrong", () => {
    expect(pointsFor({ kind: "word_answer", meta: { correct: true } })).toBe(10);
    expect(pointsFor({ kind: "word_answer", meta: { correct: false } })).toBe(0);
    expect(pointsFor({ kind: "word_answer" })).toBe(0);
  });

  it("fixed events", () => {
    expect(pointsFor({ kind: "word_known" })).toBe(5);
    expect(pointsFor({ kind: "grammar_credit" })).toBe(10);
    expect(pointsFor({ kind: "goal_met" })).toBe(25);
    expect(pointsFor({ kind: "milestone" })).toBe(0);
  });

  it("grammar answers: translation is worth 15", () => {
    expect(pointsFor({ kind: "grammar_answer", meta: { correct: true } })).toBe(10);
    expect(
      pointsFor({ kind: "grammar_answer", meta: { correct: true, questionType: "translation" } }),
    ).toBe(15);
    expect(
      pointsFor({ kind: "grammar_answer", meta: { correct: false, questionType: "translation" } }),
    ).toBe(0);
  });

  it("TOPIK answers: blank 15, serious 20", () => {
    expect(pointsFor({ kind: "topik_answer", meta: { correct: true, mode: "blank" } })).toBe(15);
    expect(pointsFor({ kind: "topik_answer", meta: { correct: true } })).toBe(POINTS.topikBlank);
    expect(pointsFor({ kind: "topik_answer", meta: { correct: true, mode: "serious" } })).toBe(20);
    expect(pointsFor({ kind: "topik_answer", meta: { correct: false, mode: "serious" } })).toBe(0);
    expect(pointsFor({ kind: "topik_answer", meta: null })).toBe(0);
  });
});
