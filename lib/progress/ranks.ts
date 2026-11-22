/** Effort ranks by cumulative points per language (docs/DESIGN.md §4). */
export const RANKS = [
  { name: "Novice", floor: 0 },
  { name: "Beginner I", floor: 1_000 },
  { name: "Beginner II", floor: 2_500 },
  { name: "Elementary I", floor: 4_500 },
  { name: "Elementary II", floor: 7_000 },
  { name: "Intermediate I", floor: 10_500 },
  { name: "Intermediate II", floor: 15_000 },
  { name: "Upper-intermediate", floor: 22_000 },
  { name: "Advanced I", floor: 30_000 },
  { name: "Advanced II", floor: 40_000 },
  { name: "Expert", floor: 55_000 },
] as const;

export type Rank = {
  name: string;
  floor: number;
  next?: { name: string; at: number };
  /** 0–100 progress from this rank's floor to the next one (100 at the top rank). */
  pctToNext: number;
};

export function rankFor(points: number): Rank {
  const p = Number.isFinite(points) ? Math.max(0, points) : 0;
  let i = 0;
  while (i + 1 < RANKS.length && p >= RANKS[i + 1].floor) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1];
  if (!next) return { name: rank.name, floor: rank.floor, pctToNext: 100 };
  return {
    name: rank.name,
    floor: rank.floor,
    next: { name: next.name, at: next.floor },
    pctToNext: ((p - rank.floor) / (next.floor - rank.floor)) * 100,
  };
}
