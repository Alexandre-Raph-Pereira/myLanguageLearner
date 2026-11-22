import type { ReactNode } from "react";
import { clampPct, scaleStep, stepClasses, type ScaleTone } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./progress-bar";

/** Name + sub line + big % (scale colour) + delta + bar. */
export function LedgerRow({
  name,
  sub,
  pct,
  delta,
  tone,
  className,
}: {
  name: ReactNode;
  sub?: ReactNode;
  /** `null` = not measured yet (shows "–", muted). */
  pct: number | null;
  /** Change in percentage points since the previous period. */
  delta?: number;
  tone?: ScaleTone;
  className?: string;
}) {
  const value = pct === null ? null : clampPct(pct);
  const step = tone ?? (value === null ? "muted" : scaleStep(value));
  return (
    <div className={cn("flex flex-col gap-2 py-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{name}</div>
          {sub && <div className="text-muted-foreground truncate text-[13px]">{sub}</div>}
        </div>
        <div className="flex shrink-0 items-baseline gap-2">
          {delta !== undefined && delta !== 0 && (
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                delta > 0 ? "text-level-2-text" : "text-level-0-text",
              )}
            >
              {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}
            </span>
          )}
          <span
            className={cn("font-display text-2xl leading-none font-medium", stepClasses(step).text)}
          >
            {value === null ? "–" : `${value}%`}
          </span>
        </div>
      </div>
      <ProgressBar
        pct={value ?? 0}
        tone={step}
        size="sm"
        label={typeof name === "string" ? name : "Progress"}
      />
    </div>
  );
}
