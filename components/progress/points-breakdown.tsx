import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Ledger list of point lines + bold brass total. */
export function PointsBreakdown({
  lines,
  className,
}: {
  lines: { label: string; points: number }[];
  className?: string;
}) {
  const total = lines.reduce((a, l) => a + l.points, 0);
  return (
    <dl className={cn("flex flex-col text-[15px]", className)}>
      {lines.map((l, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-3 border-b border-dashed py-2"
        >
          <dt className="text-muted-foreground">{l.label}</dt>
          <dd className="font-semibold tabular-nums">+{fmt(l.points)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 pt-3">
        <dt className="font-semibold">Total</dt>
        <dd className="font-display text-brass-text text-2xl font-bold tabular-nums">
          +{fmt(total)} pts
        </dd>
      </div>
    </dl>
  );
}
