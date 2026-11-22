"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { breakdownLines } from "@/lib/progress/breakdown";
import type { ActivityResult } from "@/lib/progress/record";
import { clampPct } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";
import { GoalMetBanner } from "./goal-met-banner";
import { PointsBreakdown } from "./points-breakdown";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Rank bar: earlier progress in navy, this session's gain in brass (+ the numbers). */
function RankProgress({ result }: { result: ActivityResult }) {
  const { rank, pointsTotal, pointsAdded } = result;
  const span = rank.next ? rank.next.at - rank.floor : 1;
  const after = rank.next ? clampPct(((pointsTotal - rank.floor) / span) * 100) : 100;
  const before = rank.next
    ? clampPct(((Math.max(pointsTotal - pointsAdded, rank.floor) - rank.floor) / span) * 100)
    : 100;
  return (
    <section aria-label="Rank progress" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl font-medium">{rank.name}</span>
        <span className="text-[13px] tabular-nums">
          <span className="text-brass-text font-semibold">+{fmt(pointsAdded)}</span>
          <span className="text-muted-foreground"> · {fmt(pointsTotal)} pts</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={rank.next ? `Progress to ${rank.next.name}` : "Top rank"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={after}
        className="bg-track flex h-2 w-full overflow-hidden rounded-full"
      >
        <span className="bg-level-3 h-full" style={{ width: `${before}%` }} />
        <span className="bg-brass h-full" style={{ width: `${Math.max(after - before, 0)}%` }} />
      </div>
      <span className="text-muted-foreground text-[13px]">
        {rank.next
          ? `${fmt(rank.next.at - pointsTotal)} pts to ${rank.next.name}`
          : "Top rank reached"}
      </span>
    </section>
  );
}

/**
 * Shared end-of-session block for word / grammar / TOPIK results pages:
 * goal-met banner, points breakdown, rank progress, and one toast per new milestone.
 */
export function SessionSummary({
  result,
  celebrateMilestones = true,
  showPoints = true,
  children,
  className,
}: {
  result: ActivityResult;
  celebrateMilestones?: boolean;
  showPoints?: boolean;
  /** Session-specific content rendered between the banner and the points (score, mistakes…). */
  children?: ReactNode;
  className?: string;
}) {
  const toasted = useRef(false);
  useEffect(() => {
    if (!celebrateMilestones || toasted.current) return;
    toasted.current = true;
    for (const m of result.newMilestones) {
      toast(`Milestone reached: ${m.label}`);
    }
  }, [celebrateMilestones, result.newMilestones]);

  const lines = breakdownLines(result.awarded);
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {result.goal.justMet && <GoalMetBanner streak={result.streak.current} />}
      {celebrateMilestones && result.newMilestones.length > 0 && (
        <p role="status" className="text-brass-text text-[15px] font-semibold">
          Milestone{result.newMilestones.length > 1 ? "s" : ""} reached:{" "}
          {result.newMilestones.map((m) => m.label).join(" · ")}
        </p>
      )}
      {children}
      {showPoints && (
        <div className="bg-card flex flex-col gap-4 rounded-2xl border p-4 md:p-5">
          <h2 className="overline-label">Points</h2>
          {lines.length > 0 ? (
            <PointsBreakdown lines={lines} />
          ) : (
            <p className="text-muted-foreground text-[15px]">No points this session.</p>
          )}
          <RankProgress result={result} />
        </div>
      )}
    </div>
  );
}
