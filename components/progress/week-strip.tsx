import { clampPct } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

export type WeekDay = {
  /** Short label, e.g. "M". */
  label: string;
  /** Full name for screen readers, e.g. "Monday". */
  name?: string;
  status: "met" | "missed" | "future" | "today";
  /** Today's goal % (partial fill). */
  pct?: number;
};

const STATUS_TEXT: Record<WeekDay["status"], string> = {
  met: "goal met",
  missed: "goal not met",
  future: "upcoming",
  today: "today",
};

/** 7 segments Mon–Sun: goal met = brass, not met / future = track; today = partial. */
export function WeekStrip({ days, className }: { days: WeekDay[]; className?: string }) {
  return (
    <ol aria-label="This week" className={cn("grid grid-cols-7 gap-1.5", className)}>
      {days.map((d, i) => {
        const pct = d.status === "met" ? 100 : d.status === "today" ? clampPct(d.pct ?? 0) : 0;
        const text =
          d.status === "today"
            ? `${d.name ?? d.label}: today, ${pct}%`
            : `${d.name ?? d.label}: ${STATUS_TEXT[d.status]}`;
        return (
          <li key={i} aria-label={text} className="flex flex-col items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "bg-track h-2 w-full overflow-hidden rounded-full",
                d.status === "today" && "ring-brass/60 ring-1",
              )}
            >
              <span className="bg-brass block h-full" style={{ width: `${pct}%` }} />
            </span>
            <span
              aria-hidden
              className={cn(
                "text-[11px]",
                d.status === "today" ? "text-foreground font-semibold" : "text-muted-foreground",
              )}
            >
              {d.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
