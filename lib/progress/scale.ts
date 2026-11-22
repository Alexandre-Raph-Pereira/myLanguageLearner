/**
 * The 4-step progress scale (docs/DESIGN.md §1): word levels 0–3 and any percentage
 * share the same colours. Pure helpers — no React.
 */

export type Step = 0 | 1 | 2 | 3;
/** `muted` = nothing measured yet (e.g. grammar not tested). */
export type ScaleTone = Step | "muted";

/** < 40 → 0, < 60 → 1, < 80 → 2, else 3. NaN / non-finite → 0. */
export function scaleStep(pct: number): Step {
  if (!Number.isFinite(pct) || pct < 40) return 0;
  if (pct < 60) return 1;
  if (pct < 80) return 2;
  return 3;
}

/** Word level (0–3) → step; clamps out-of-range values. */
export function levelStep(level: number): Step {
  if (!Number.isFinite(level) || level <= 0) return 0;
  if (level >= 3) return 3;
  return Math.floor(level) as Step;
}

export type MasteryState = "not_tested" | "learning" | "mastered";

/** Grammar mastery: not tested → muted, learning → step from %, mastered → 3. */
export function masteryStep(state: MasteryState, pct: number): ScaleTone {
  if (state === "not_tested") return "muted";
  if (state === "mastered") return 3;
  return scaleStep(pct);
}

export type StepClasses = { fill: string; text: string; onFill: string; soft: string };

// Literal class names so Tailwind can see them.
const CLASSES: Record<ScaleTone, StepClasses> = {
  0: {
    fill: "bg-level-0",
    text: "text-level-0-text",
    onFill: "text-on-level-0",
    soft: "bg-level-0/15",
  },
  1: {
    fill: "bg-level-1",
    text: "text-level-1-text",
    onFill: "text-on-level-1",
    soft: "bg-level-1/15",
  },
  2: {
    fill: "bg-level-2",
    text: "text-level-2-text",
    onFill: "text-on-level-2",
    soft: "bg-level-2/15",
  },
  3: {
    fill: "bg-level-3",
    text: "text-level-3-text",
    onFill: "text-on-level-3",
    soft: "bg-level-3/15",
  },
  muted: {
    fill: "bg-border-strong",
    text: "text-muted-foreground",
    onFill: "text-foreground",
    soft: "bg-track",
  },
};

export function stepClasses(step: ScaleTone): StepClasses {
  return CLASSES[step];
}

/** CSS variable of a step's fill colour (for inline conic-gradients). */
export function stepVar(step: ScaleTone): string {
  return step === "muted" ? "var(--border-strong)" : `var(--level-${step})`;
}

export const LEVEL_LABELS: Record<Step, string> = {
  0: "New",
  1: "Learning",
  2: "Known",
  3: "Mastered",
};

/** Clamp to 0–100 and round for display. NaN → 0. */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Daily goal % (DESIGN.md §4): average of the capped word and lesson ratios. */
export function goalPercent(
  words: { done: number; goal: number },
  lessons: { done: number; goal: number },
): number {
  const ratio = (d: number, g: number) => (g > 0 ? Math.min(Math.max(d, 0) / g, 1) : 1);
  return ((ratio(words.done, words.goal) + ratio(lessons.done, lessons.goal)) / 2) * 100;
}
