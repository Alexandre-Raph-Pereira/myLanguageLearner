import { cn } from "@/lib/utils";

/** Estimated exam level chip ("TOPIK 2"); "No level" when unknown. */
export function ExamLevelChip({
  level,
  exam = "TOPIK",
  className,
}: {
  level: number | null;
  exam?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-track text-foreground inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        level === null && "text-muted-foreground font-medium",
        className,
      )}
    >
      {level === null ? "No level" : `${exam} ${level}`}
    </span>
  );
}
