import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small card: overline, big number, sub line. */
export function StatTile({
  label,
  value,
  sub,
  valueClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card flex flex-col gap-1 rounded-2xl border p-4", className)}>
      <span className="overline-label">{label}</span>
      <span className={cn("font-display text-3xl leading-tight font-medium", valueClassName)}>
        {value}
      </span>
      {sub && <span className="text-muted-foreground text-[13px]">{sub}</span>}
    </div>
  );
}
