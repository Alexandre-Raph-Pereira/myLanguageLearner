import { clampPct, scaleStep, stepClasses, type ScaleTone } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

export type MiniBar = {
  label?: string;
  /** Bar height, 0–100. */
  pct: number;
  /** Fill override (default: scale colour of `pct`); `track` for empty / neutral bars. */
  tone?: ScaleTone | "brass" | "track";
  /** What the bar means for screen readers and the tooltip (default `${pct}%`). */
  text?: string;
};

const toneClass = (tone: MiniBar["tone"], v: number) =>
  tone === "brass"
    ? "bg-brass"
    : tone === "track"
      ? "bg-border-strong"
      : stepClasses(tone ?? scaleStep(v)).fill;

/** CSS bar chart (≤ 12 bars), each coloured by the scale — e.g. score history. */
export function MiniBars({
  values,
  label = "Score history",
  height = 56,
  className,
}: {
  values: MiniBar[];
  label?: string;
  height?: number;
  className?: string;
}) {
  const bars = values.slice(-12);
  const textOf = (b: MiniBar) => b.text ?? `${clampPct(b.pct)}%`;
  const summary = bars.map((b) => `${b.label ? `${b.label} ` : ""}${textOf(b)}`).join(", ");
  return (
    <div
      role="img"
      aria-label={`${label}: ${summary || "no data"}`}
      className={cn("flex items-end gap-1", className)}
      style={{ height }}
    >
      {bars.map((b, i) => {
        const v = clampPct(b.pct);
        return (
          <span
            key={i}
            aria-hidden
            title={`${b.label ? `${b.label}: ` : ""}${textOf(b)}`}
            className={cn("min-h-1 flex-1 rounded-t-sm", toneClass(b.tone, v))}
            style={{ height: `${Math.max(v, 4)}%` }}
          />
        );
      })}
    </div>
  );
}
