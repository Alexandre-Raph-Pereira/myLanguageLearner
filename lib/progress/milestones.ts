/** The 24 milestones (docs/DESIGN.md §4) and their evaluation. Pure. */

export type MilestoneGroup = "words" | "grammar" | "streak" | "coverage" | "topik";

export type Milestone = {
  id: string;
  group: MilestoneGroup;
  /** Count to reach; for `coverage` the TOPIK level (list fully covered = 100 %); for `topik` the score %. */
  threshold: number;
  label: string;
};

const fmt = (n: number) => n.toLocaleString("en-US");

export const MILESTONES: readonly Milestone[] = [
  ...[50, 100, 250, 450, 700, 1000, 1500, 2000].map((n) => ({
    id: `words-${n}`,
    group: "words" as const,
    threshold: n,
    label: `${fmt(n)} words known`,
  })),
  ...[5, 10, 25, 50, 100].map((n) => ({
    id: `grammar-${n}`,
    group: "grammar" as const,
    threshold: n,
    label: `${n} grammar points mastered`,
  })),
  ...[7, 30, 100, 365].map((n) => ({
    id: `streak-${n}`,
    group: "streak" as const,
    threshold: n,
    label: `${n}-day streak`,
  })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    id: `coverage-${n}`,
    group: "coverage" as const,
    threshold: n,
    label: `TOPIK level ${n} list fully covered`,
  })),
  { id: "topik-serious-70", group: "topik", threshold: 70, label: "Serious TOPIK test ≥ 70%" },
];

export const MILESTONES_BY_ID: ReadonlyMap<string, Milestone> = new Map(
  MILESTONES.map((m) => [m.id, m]),
);

/** Inputs for milestones. `null` / missing = the data source does not exist yet. */
export type MilestoneSnapshot = {
  wordsKnown?: number | null;
  grammarMastered?: number | null;
  /** Current streak (days). */
  streak?: number | null;
  /** Coverage % of the reference list per TOPIK level (1–6). */
  coverageByLevel?: Partial<Record<number, number>> | null;
  /** Best serious-mode TOPIK score %. */
  bestSeriousTopik?: number | null;
};

export type MilestoneEvaluation = {
  earned: string[];
  /** 0–100, or null when the data source is missing. */
  progress: Record<string, number | null>;
};

const ratio = (value: number, target: number) => Math.min(Math.max(value, 0) / target, 1) * 100;

function progressOf(m: Milestone, s: MilestoneSnapshot): number | null {
  switch (m.group) {
    case "words":
      return s.wordsKnown == null ? null : ratio(s.wordsKnown, m.threshold);
    case "grammar":
      return s.grammarMastered == null ? null : ratio(s.grammarMastered, m.threshold);
    case "streak":
      return s.streak == null ? null : ratio(s.streak, m.threshold);
    case "coverage": {
      const pct = s.coverageByLevel?.[m.threshold];
      return pct == null ? null : ratio(pct, 100);
    }
    case "topik":
      return s.bestSeriousTopik == null ? null : ratio(s.bestSeriousTopik, m.threshold);
  }
}

export function evaluate(snapshot: MilestoneSnapshot): MilestoneEvaluation {
  const progress: Record<string, number | null> = {};
  const earned: string[] = [];
  for (const m of MILESTONES) {
    const p = progressOf(m, snapshot);
    progress[m.id] = p;
    if (p !== null && p >= 100) earned.push(m.id);
  }
  return { earned, progress };
}

/** Locked milestone closest to completion (ties → catalog order), or null. */
export function nextMilestone(
  evaluation: MilestoneEvaluation,
  alreadyEarned: Iterable<string> = [],
): { milestone: Milestone; pct: number } | null {
  const done = new Set([...alreadyEarned, ...evaluation.earned]);
  let best: { milestone: Milestone; pct: number } | null = null;
  for (const m of MILESTONES) {
    const pct = evaluation.progress[m.id];
    if (done.has(m.id) || pct == null) continue;
    if (!best || pct > best.pct) best = { milestone: m, pct };
  }
  return best;
}
