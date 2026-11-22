import { ProgressBar } from "@/components/progress";
import { rankFor } from "@/lib/progress/ranks";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Desktop sidebar footer: rank name, points and bar to the next rank. */
export function SidebarRank({ points }: { points: number }) {
  const rank = rankFor(points);
  return (
    <div className="flex flex-col gap-2" aria-label="Rank" role="group">
      <span className="overline-label">Rank</span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[15px] font-medium">{rank.name}</span>
        <span className="text-brass-text text-xs font-semibold tabular-nums">
          {fmt(points)} pts
        </span>
      </div>
      <ProgressBar
        pct={rank.pctToNext}
        tone="brass"
        size="sm"
        label={rank.next ? `Progress to ${rank.next.name}` : "Top rank"}
      />
      <span className="text-muted-foreground text-xs">
        {rank.next ? `${fmt(rank.next.at - points)} pts to ${rank.next.name}` : "Top rank"}
      </span>
    </div>
  );
}
