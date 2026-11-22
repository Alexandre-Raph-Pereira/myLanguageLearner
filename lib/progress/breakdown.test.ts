import { describe, expect, it } from "vitest";
import { breakdownLines } from "./breakdown";

describe("breakdownLines", () => {
  it("groups by kind, counts, skips 0-point events", () => {
    expect(
      breakdownLines([
        { kind: "word_answer", points: 10 },
        { kind: "word_answer", points: 10 },
        { kind: "word_answer", points: 0 },
        { kind: "word_known", points: 5 },
        { kind: "grammar_credit", points: 10 },
        { kind: "grammar_answer", points: 10 },
        { kind: "grammar_answer", points: 15, meta: { questionType: "translation" } },
        { kind: "topik_answer", points: 20 },
        { kind: "goal_met", points: 25 },
        { kind: "milestone", points: 0 },
      ]),
    ).toEqual([
      { label: "Correct answers × 2", points: 20 },
      { label: "Words now known", points: 5 },
      { label: "Grammar lessons credited", points: 10 },
      { label: "Grammar questions correct", points: 10 },
      { label: "Translations correct", points: 15 },
      { label: "TOPIK questions correct", points: 20 },
      { label: "Daily goal met", points: 25 },
    ]);
  });

  it("empty → no lines", () => {
    expect(breakdownLines([])).toEqual([]);
  });
});
