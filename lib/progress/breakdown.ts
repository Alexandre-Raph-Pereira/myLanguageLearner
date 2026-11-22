import type { ActivityKind } from "@/db/schema/progress";

type Awarded = { kind: ActivityKind; points: number; meta?: Record<string, unknown> | null };

const fmt = (n: number) => n.toLocaleString("en-US");

function lineKey(e: Awarded): { key: string; label: string } | null {
  switch (e.kind) {
    case "word_answer":
      return { key: "word", label: "Correct answers" };
    case "word_known":
      return { key: "known", label: "Words now known" };
    case "grammar_credit":
      return { key: "credit", label: "Grammar lessons credited" };
    case "grammar_answer":
      return e.meta?.questionType === "translation"
        ? { key: "translation", label: "Translations correct" }
        : { key: "grammar", label: "Grammar questions correct" };
    case "topik_answer":
      return { key: "topik", label: "TOPIK questions correct" };
    case "goal_met":
      return { key: "goal", label: "Daily goal met" };
    case "milestone":
      return null;
  }
}

/** Groups a session's awarded events into PointsBreakdown lines ("Correct answers × 14"). 0-point events are left out. */
export function breakdownLines(events: Awarded[]): { label: string; points: number }[] {
  const groups = new Map<string, { label: string; points: number; count: number }>();
  for (const e of events) {
    if (e.points <= 0) continue;
    const k = lineKey(e);
    if (!k) continue;
    const g = groups.get(k.key) ?? { label: k.label, points: 0, count: 0 };
    g.points += e.points;
    g.count += 1;
    groups.set(k.key, g);
  }
  return [...groups.entries()].map(([key, g]) => ({
    label: key === "goal" || g.count === 1 ? g.label : `${g.label} × ${fmt(g.count)}`,
    points: g.points,
  }));
}
