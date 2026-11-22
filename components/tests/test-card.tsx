import { cn } from "@/lib/utils";
import type { TestEntry } from "./test-catalog";

/** Test entry card; disabled (muted, "Available after plan NN") until its plan ships. */
export function TestCard({ entry, className }: { entry: TestEntry; className?: string }) {
  const Icon = entry.icon;
  return (
    <article
      data-disabled=""
      aria-labelledby={`test-${entry.id}`}
      className={cn("bg-card flex flex-col gap-3 rounded-2xl border p-4 md:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="bg-track text-muted-foreground flex size-10 items-center justify-center rounded-xl">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="text-muted-foreground border-border-strong rounded-full border border-dashed px-2.5 py-1 text-xs font-medium">
          Available after plan {entry.plan}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 id={`test-${entry.id}`} className="font-display text-xl font-medium">
          {entry.title}
        </h3>
        <p className="text-muted-foreground text-[13px]">{entry.description}</p>
      </div>
    </article>
  );
}

/** Slot for an unfinished test; empty state until plans 01/03/05 store sessions. */
export function ResumeSlot() {
  return (
    <div
      data-slot="resume-test"
      className="border-border-strong flex flex-col gap-1 rounded-2xl border border-dashed p-4"
    >
      <span className="overline-label">Resume</span>
      <span className="text-[15px] font-semibold">No unfinished test</span>
      <span className="text-muted-foreground text-[13px]">
        An unfinished test will appear here so you can pick it up where you left off.
      </span>
    </div>
  );
}
