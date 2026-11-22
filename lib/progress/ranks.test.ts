import { describe, expect, it } from "vitest";
import { RANKS, rankFor } from "./ranks";

describe("rankFor", () => {
  it("has 11 ranks in increasing order", () => {
    expect(RANKS).toHaveLength(11);
    for (let i = 1; i < RANKS.length; i++)
      expect(RANKS[i].floor).toBeGreaterThan(RANKS[i - 1].floor);
  });

  it("boundaries", () => {
    expect(rankFor(0).name).toBe("Novice");
    expect(rankFor(999).name).toBe("Novice");
    expect(rankFor(1000).name).toBe("Beginner I");
    expect(rankFor(14_999).name).toBe("Intermediate I");
    expect(rankFor(15_000).name).toBe("Intermediate II");
    expect(rankFor(54_999).name).toBe("Advanced II");
    expect(rankFor(55_000).name).toBe("Expert");
  });

  it("progress to next rank", () => {
    expect(rankFor(0)).toEqual({
      name: "Novice",
      floor: 0,
      next: { name: "Beginner I", at: 1000 },
      pctToNext: 0,
    });
    const r = rankFor(18_700);
    expect(r.name).toBe("Intermediate II");
    expect(r.next).toEqual({ name: "Upper-intermediate", at: 22_000 });
    expect(r.pctToNext).toBeCloseTo((3_700 / 7_000) * 100);
  });

  it("top rank has no next and 100%", () => {
    expect(rankFor(100_000)).toEqual({ name: "Expert", floor: 55_000, pctToNext: 100 });
  });

  it("negative / NaN → Novice", () => {
    expect(rankFor(-5).name).toBe("Novice");
    expect(rankFor(Number.NaN).pctToNext).toBe(0);
  });
});
