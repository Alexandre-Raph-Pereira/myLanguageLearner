import { LEVEL_LABELS, stepClasses, type Step } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

const STEPS: Step[] = [0, 1, 2, 3];

/** Stacked bar of word counts per level 0–3, with a counted legend. */
export function LevelBar({
  counts,
  legend = true,
  className,
}: {
  counts: [number, number, number, number];
  legend?: boolean;
  className?: string;
}) {
  const total = counts.reduce((a, b) => a + b, 0);
  const summary = STEPS.map((s) => `level ${s} ${counts[s]}`).join(", ");
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="img"
        aria-label={`Words by level: ${summary}`}
        className="bg-track flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {total > 0 &&
          STEPS.filter((s) => counts[s] > 0).map((s) => (
            <div
              key={s}
              className={cn("h-full", stepClasses(s).fill)}
              style={{ flexGrow: counts[s], flexBasis: 0 }}
            />
          ))}
      </div>
      {legend && (
        <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STEPS.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", stepClasses(s).fill)} />
              <span className="text-muted-foreground">{LEVEL_LABELS[s]}</span>
              <span className="font-semibold tabular-nums">{counts[s]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
