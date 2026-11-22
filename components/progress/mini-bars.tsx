import { clampPct, scaleStep, stepClasses } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

/** CSS bar chart (≤ 12 bars), each coloured by the scale — e.g. score history. */
export function MiniBars({
  values,
  label = "Score history",
  height = 56,
  className,
}: {
  values: { label?: string; pct: number }[];
  label?: string;
  height?: number;
  className?: string;
}) {
  const bars = values.slice(-12);
  const summary = bars.map((b) => `${b.label ? `${b.label} ` : ""}${clampPct(b.pct)}%`).join(", ");
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
            title={`${b.label ? `${b.label}: ` : ""}${v}%`}
            className={cn("min-h-1 flex-1 rounded-t-sm", stepClasses(scaleStep(v)).fill)}
            style={{ height: `${Math.max(v, 4)}%` }}
          />
        );
      })}
    </div>
  );
}
