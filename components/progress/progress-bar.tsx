import { clampPct, scaleStep, stepClasses, type ScaleTone } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

/** 6–8 px rounded bar on `track`; colour from the scale unless `tone` overrides it. */
export function ProgressBar({
  pct,
  tone,
  label = "Progress",
  size = "md",
  className,
}: {
  pct: number;
  tone?: ScaleTone | "brass";
  /** Accessible name. Show the number next to the bar yourself (colour never alone). */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const value = clampPct(pct);
  const fill = tone === "brass" ? "bg-brass" : stepClasses(tone ?? scaleStep(value)).fill;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn(
        "bg-track w-full overflow-hidden rounded-full",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${value}%` }} />
    </div>
  );
}
