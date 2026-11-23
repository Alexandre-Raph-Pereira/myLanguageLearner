import { clampPct, scaleStep, stepVar, type ScaleTone } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";
import { Ring } from "./ring";

/** Single ring coloured by the scale (results score, lesson mastery); % in the centre. */
export function ProgressRing({
  pct,
  size = 96,
  label = "Progress",
  step,
  sub,
  className,
}: {
  pct: number;
  size?: number;
  /** Accessible name prefix, e.g. "Score". */
  label?: string;
  /** Override the scale step (e.g. `muted` for not tested). */
  step?: ScaleTone;
  /** Small line under the number (e.g. "18 / 25"). */
  sub?: string;
  className?: string;
}) {
  const value = clampPct(pct);
  const tone = step ?? scaleStep(value);
  return (
    <div
      role="img"
      aria-label={
        tone === "muted"
          ? `${label}: not measured yet`
          : `${label} ${value}%${sub ? `, ${sub}` : ""}`
      }
      className={cn("relative flex shrink-0 flex-col items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <Ring
        pct={tone === "muted" ? 0 : value}
        color={stepVar(tone)}
        track="var(--track)"
        thickness={Math.max(6, Math.round(size * 0.09))}
        className="absolute inset-0"
      />
      <span
        aria-hidden
        className="font-display relative leading-none font-medium"
        style={{ fontSize: Math.round(size * 0.26) }}
      >
        {tone === "muted" ? "–" : `${value}%`}
      </span>
      {sub && (
        <span aria-hidden className="text-muted-foreground relative mt-1 text-xs">
          {sub}
        </span>
      )}
    </div>
  );
}
