import { describe, expect, it } from "vitest";
import { seededRng, selectWords, shuffle, weightOf, type Candidate } from "./select";

const NOW = new Date("2026-11-22T10:00:00Z");
const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000);
const c = (id: string, level: number, dueInHours: number): Candidate => ({
  id,
  level,
  dueAt: at(dueInHours),
});

describe("selectWords", () => {
  it("weights: level 0 → 4 … level 3 → 1", () => {
    expect([0, 1, 2, 3, 9, -1].map(weightOf)).toEqual([4, 3, 2, 1, 1, 4]);
  });

  it("only picks due words when enough are due, without duplicates", () => {
    const due = Array.from({ length: 30 }, (_, i) => c(`d${i}`, i % 4, -1));
    const later = Array.from({ length: 5 }, (_, i) => c(`n${i}`, 0, 5));
    const picked = selectWords([...due, ...later], { count: 25, now: NOW, rng: seededRng(1) });
    expect(picked).toHaveLength(25);
    expect(new Set(picked.map((p) => p.id)).size).toBe(25);
    expect(picked.every((p) => p.id.startsWith("d"))).toBe(true);
  });

  it("tops up with not-due words ordered by due date", () => {
    const list = [c("d1", 0, 0), c("n3", 0, 30), c("n1", 3, 2), c("n2", 1, 10)];
    const picked = selectWords(list, { count: 3, now: NOW, rng: seededRng(2) });
    expect(picked.map((p) => p.id).sort()).toEqual(["d1", "n1", "n2"]);
  });

  it("returns everything when the bank is smaller than count", () => {
    const list = [c("a", 0, -1), c("b", 2, 4)];
    expect(selectWords(list, { now: NOW, rng: seededRng(3) })).toHaveLength(2);
    expect(selectWords([], { now: NOW })).toEqual([]);
  });

  it("favours low levels", () => {
    const list = [
      ...Array.from({ length: 50 }, (_, i) => c(`zero${i}`, 0, -1)),
      ...Array.from({ length: 50 }, (_, i) => c(`three${i}`, 3, -1)),
    ];
    const rng = seededRng(42);
    let zeros = 0;
    for (let i = 0; i < 40; i++) {
      zeros += selectWords(list, { count: 10, now: NOW, rng }).filter((p) => p.level === 0).length;
    }
    expect(zeros / 400).toBeGreaterThan(0.65);
  });

  it("is deterministic with a seeded rng", () => {
    const list = Array.from({ length: 20 }, (_, i) => c(`w${i}`, i % 4, -1));
    const a = selectWords(list, { count: 8, now: NOW, rng: seededRng(7) }).map((p) => p.id);
    const b = selectWords(list, { count: 8, now: NOW, rng: seededRng(7) }).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("shuffle keeps all items", () => {
    expect(shuffle([1, 2, 3, 4], seededRng(5)).sort()).toEqual([1, 2, 3, 4]);
  });
});
