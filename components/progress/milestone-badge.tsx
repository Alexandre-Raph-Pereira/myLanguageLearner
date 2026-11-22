import { Award, Lock } from "lucide-react";
import { clampPct } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

/** Earned = brass circle; locked = dashed track ring + progress %. */
export function MilestoneBadge({
  title,
  sub,
  earned,
  pct = 0,
  className,
}: {
  title: string;
  sub?: string;
  earned: boolean;
  /** Progress towards a locked milestone. */
  pct?: number;
  className?: string;
}) {
  const value = clampPct(pct);
  return (
    <div
      role="img"
      aria-label={`${title}: ${earned ? "earned" : `locked, ${value}%`}`}
      className={cn("flex w-24 flex-col items-center gap-1.5 text-center", className)}
    >
      {earned ? (
        <span className="bg-brass text-card flex size-14 items-center justify-center rounded-full">
          <Award className="size-6" aria-hidden />
        </span>
      ) : (
        <span className="border-border-strong text-muted-foreground flex size-14 flex-col items-center justify-center rounded-full border-2 border-dashed">
          <Lock className="size-3.5" aria-hidden />
          <span aria-hidden className="text-[11px] font-semibold tabular-nums">
            {value}%
          </span>
        </span>
      )}
      <span aria-hidden className="text-[13px] leading-tight font-semibold">
        {title}
      </span>
      {sub && (
        <span aria-hidden className="text-muted-foreground text-xs leading-tight">
          {sub}
        </span>
      )}
    </div>
  );
}
