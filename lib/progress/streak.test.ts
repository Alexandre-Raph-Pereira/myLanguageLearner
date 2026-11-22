import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("empty → zeros", () => {
    expect(computeStreak([], "2026-11-22")).toEqual({ current: 0, best: 0, todayMet: false });
  });

  it("today not met does not break the streak", () => {
    const s = computeStreak(["2026-11-19", "2026-11-20", "2026-11-21"], "2026-11-22");
    expect(s).toEqual({ current: 3, best: 3, todayMet: false });
  });

  it("today met extends it", () => {
    const s = computeStreak(["2026-11-20", "2026-11-21", "2026-11-22"], "2026-11-22");
    expect(s).toEqual({ current: 3, best: 3, todayMet: true });
  });

  it("a one-day gap breaks it", () => {
    const s = computeStreak(["2026-11-18", "2026-11-19", "2026-11-21"], "2026-11-22");
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
    expect(computeStreak(["2026-11-20"], "2026-11-22").current).toBe(0);
  });

  it("runs across a month end", () => {
    const s = computeStreak(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"], "2026-11-02");
    expect(s).toEqual({ current: 4, best: 4, todayMet: true });
    const feb = computeStreak(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-02");
    expect(feb.current).toBe(3);
  });

  it("keeps the best older run, ignores duplicates and future days", () => {
    const s = computeStreak(
      [
        "2026-11-01",
        "2026-11-02",
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-21",
        "2026-11-25",
      ],
      "2026-11-22",
    );
    expect(s).toEqual({ current: 1, best: 4, todayMet: false });
  });
});
