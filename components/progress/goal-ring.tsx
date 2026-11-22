import { clampPct, goalPercent } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";
import { Ring } from "./ring";

type Count = { done: number; goal: number };

const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;
const ratioPct = (c: Count) => (c.goal > 0 ? (c.done / c.goal) * 100 : 100);

/**
 * Daily goal: outer ring = words (brass), inner ring = grammar lessons (teal),
 * centre = total %. `tone="hero"` uses the hero-panel ring colours.
 */
export function GoalRing({
  words,
  lessons,
  size = 132,
  tone = "hero",
  className,
}: {
  words: Count;
  lessons: Count;
  size?: number;
  tone?: "hero" | "card";
  className?: string;
}) {
  const total = clampPct(goalPercent(words, lessons));
  const onHero = tone === "hero";
  const track = onHero ? "color-mix(in srgb, var(--on-hero) 16%, transparent)" : "var(--track)";
  const thickness = Math.round(size * 0.075);
  const inset = thickness + Math.round(size * 0.045);
  const label = `Daily goal ${total}%: ${words.done} of ${words.goal} ${plural(words.goal, "word")}, ${lessons.done} of ${lessons.goal} ${plural(lessons.goal, "lesson")}`;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Ring
        pct={ratioPct(words)}
        color={onHero ? "var(--hero-brass)" : "var(--brass)"}
        track={track}
        thickness={thickness}
        className="absolute inset-0"
      />
      <Ring
        pct={ratioPct(lessons)}
        color={onHero ? "var(--hero-teal)" : "var(--level-2)"}
        track={track}
        thickness={thickness}
        className="absolute"
        style={{ inset }}
      />
      <span
        aria-hidden
        className="font-display absolute inset-0 flex items-center justify-center font-medium"
        style={{ fontSize: Math.round(size * 0.22) }}
      >
        {total}%
      </span>
    </div>
  );
}
