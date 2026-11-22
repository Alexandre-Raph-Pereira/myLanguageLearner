import { describe, expect, it } from "vitest";
import {
  describeNextReview,
  isKnown,
  nextInterval,
  onCorrect,
  onWrong,
  resetToZero,
  scheduleOf,
  type Schedule,
} from "./scheduler";

const NOW = new Date("2026-11-22T10:00:00Z");
const DAY = 86_400_000;
const base: Schedule = {
  level: 0,
  intervalDays: 0,
  dueAt: NOW,
  lastReviewedAt: null,
  correctStreak: 0,
  timesCorrect: 0,
  timesFailed: 0,
  timesLookedUp: 0,
};

describe("onCorrect", () => {
  it("climbs 0 → 1 → 2 → 3 with 1 / 3 / 7 days", () => {
    const l1 = onCorrect(base, NOW);
    expect(l1).toMatchObject({ level: 1, intervalDays: 1, correctStreak: 1, timesCorrect: 1 });
    expect(l1.dueAt.getTime() - NOW.getTime()).toBe(DAY);
    expect(l1.lastReviewedAt).toEqual(NOW);
    const l2 = onCorrect(l1, NOW);
    expect(l2).toMatchObject({ level: 2, intervalDays: 3 });
    const l3 = onCorrect(l2, NOW);
    expect(l3).toMatchObject({ level: 3, intervalDays: 7, correctStreak: 3 });
    expect(l3.dueAt.getTime() - NOW.getTime()).toBe(7 * DAY);
  });

  it("doubles the interval at level 3, capped at 120 days", () => {
    let w = { ...base, level: 3, intervalDays: 7 };
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      w = onCorrect(w, NOW);
      seen.push(w.intervalDays);
    }
    expect(seen).toEqual([14, 28, 56, 112, 120, 120]);
    expect(w.level).toBe(3);
  });

  it("level 3 with a short interval starts doubling from 7", () => {
    expect(nextInterval(3, 0)).toBe(14);
    expect(nextInterval(2, 3)).toBe(7);
    expect(nextInterval(0, 0)).toBe(1);
  });
});

describe("onWrong / resetToZero", () => {
  it("fail goes back to level 0, due now", () => {
    const w = onWrong({ ...base, level: 3, intervalDays: 56, correctStreak: 5 }, NOW);
    expect(w).toMatchObject({ level: 0, intervalDays: 0, correctStreak: 0, timesFailed: 1 });
    expect(w.dueAt).toEqual(NOW);
    expect(w.lastReviewedAt).toEqual(NOW);
  });

  it("lookup reset counts the lookup; manual reset does not", () => {
    const w = { ...base, level: 2, intervalDays: 3, correctStreak: 2 };
    expect(resetToZero(w, NOW)).toMatchObject({ level: 0, timesLookedUp: 1, correctStreak: 0 });
    expect(resetToZero(w, NOW, "manual")).toMatchObject({ level: 0, timesLookedUp: 0 });
  });
});

describe("helpers", () => {
  it("known = level ≥ 2", () => {
    expect([0, 1, 2, 3].map((level) => isKnown({ level }))).toEqual([false, false, true, true]);
  });
  it("describes the next review", () => {
    expect(describeNextReview(0)).toBe("back in today's review");
    expect(describeNextReview(1)).toBe("in 1 day");
    expect(describeNextReview(7)).toBe("in 7 days");
  });
  it("scheduleOf picks schedule fields only", () => {
    expect(scheduleOf({ ...base, term: "x" } as Schedule)).toEqual(base);
  });
});
