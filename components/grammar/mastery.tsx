import { ProgressRing } from "@/components/progress";
import { stepClasses } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";

/** Library badge slot (plan 03 fills it with the scale colour + %). */
export function MasteryBadge({ className }: { className?: string }) {
  const c = stepClasses("muted");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm px-2 text-xs font-semibold whitespace-nowrap",
        c.soft,
        c.text,
        className,
      )}
    >
      Not tested
    </span>
  );
}

/** Lesson mastery card: ring + state + last-10 attempt strip. Not tested until plan 03. */
export function MasteryCard() {
  return (
    <section
      aria-label="Mastery"
      className="bg-card flex items-center gap-4 rounded-2xl border p-4"
      data-testid="mastery-card"
    >
      <ProgressRing pct={0} step="muted" size={72} label="Mastery" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="overline-label">Mastery</span>
        <span className="text-muted-foreground text-[15px] font-medium">Not tested yet</span>
        <div aria-label="Last 10 attempts: none yet" role="img" className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="bg-track h-1.5 flex-1 rounded-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
