import { ArrowRight } from "lucide-react";
import { LEVEL_LABELS, levelStep, stepClasses } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

/** "Lv 2" pill on the level fill, optional label ("Known"). */
export function LevelBadge({
  level,
  showLabel = false,
  className,
}: {
  level: number;
  showLabel?: boolean;
  className?: string;
}) {
  const step = levelStep(level);
  const c = stepClasses(step);
  return (
    <span
      aria-label={`Level ${step}${showLabel ? ` (${LEVEL_LABELS[step]})` : ""}`}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-bold whitespace-nowrap",
        c.fill,
        c.onFill,
        className,
      )}
    >
      <span aria-hidden>
        Lv {step}
        {showLabel && <span className="font-semibold"> · {LEVEL_LABELS[step]}</span>}
      </span>
    </span>
  );
}

/** Badge → arrow → badge (e.g. after an answer). */
export function LevelTransition({ from, to }: { from: number; to: number }) {
  return (
    <span
      role="img"
      aria-label={`Level ${levelStep(from)} to ${levelStep(to)}`}
      className="inline-flex items-center gap-1.5"
    >
      <LevelBadge level={from} />
      <ArrowRight aria-hidden className="text-muted-foreground size-4" />
      <LevelBadge level={to} />
    </span>
  );
}
