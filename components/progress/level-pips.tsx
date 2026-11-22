import { levelStep, stepClasses } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

/** Three small bars filled up to the level, coloured by the level; "Lv n" underneath. */
export function LevelPips({ level, className }: { level: number; className?: string }) {
  const step = levelStep(level);
  const c = stepClasses(step);
  return (
    <span
      role="img"
      aria-label={`Level ${step} of 3`}
      className={cn("inline-flex flex-col items-center gap-1", className)}
    >
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= step ? c.fill : "bg-track")} />
        ))}
      </span>
      <span aria-hidden className={cn("text-[11px] leading-none font-semibold", c.text)}>
        Lv {step}
      </span>
    </span>
  );
}
