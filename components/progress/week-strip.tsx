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
export function WeekStrip({
  days,
  tone = "card",
  className,
}: {
  days: WeekDay[];
  /** `hero` = on the inverted hero panel (hero ring colours). */
  tone?: "card" | "hero";
  className?: string;
}) {
  const onHero = tone === "hero";
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
                "h-2 w-full overflow-hidden rounded-full",
                onHero ? "bg-on-hero/15" : "bg-track",
                d.status === "today" &&
                  (onHero ? "ring-hero-brass/70 ring-1" : "ring-brass/60 ring-1"),
              )}
            >
              <span
                className={cn("block h-full", onHero ? "bg-hero-brass" : "bg-brass")}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span
              aria-hidden
              className={cn(
                "text-[11px]",
                d.status === "today"
                  ? onHero
                    ? "font-semibold"
                    : "text-foreground font-semibold"
                  : onHero
                    ? "opacity-70"
                    : "text-muted-foreground",
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
