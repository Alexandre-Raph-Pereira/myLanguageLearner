/** Word-test selection: weighted random among due words, topped up with the soonest due. */

export type Candidate = { id: string; level: number; dueAt: Date };
export type Rng = () => number;

export const DEFAULT_TEST_SIZE = 25;

/** Lower level = more likely: level 0 → 4 … level 3 → 1. */
export function weightOf(level: number): number {
  return 4 - Math.min(Math.max(level, 0), 3);
}

/** Weighted sampling without replacement (Efraimidis–Spirakis keys). */
function weightedSample<T extends Candidate>(items: T[], k: number, rng: Rng): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(rng() || Number.MIN_VALUE, 1 / weightOf(item.level)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((x) => x.item);
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function selectWords<T extends Candidate>(
  candidates: T[],
  { count = DEFAULT_TEST_SIZE, now, rng = Math.random }: { count?: number; now: Date; rng?: Rng },
): T[] {
  const due = candidates.filter((c) => c.dueAt.getTime() <= now.getTime());
  const picked = weightedSample(due, count, rng);
  if (picked.length < count) {
    const notDue = candidates
      .filter((c) => c.dueAt.getTime() > now.getTime())
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.id.localeCompare(b.id));
    picked.push(...notDue.slice(0, count - picked.length));
  }
  return shuffle(picked, rng);
}

/** Deterministic PRNG for tests (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
