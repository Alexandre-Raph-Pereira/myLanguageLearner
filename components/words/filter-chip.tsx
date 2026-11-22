import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pill link used as a filter toggle (active = navy fill), with an optional dot and count. */
export function FilterChip({
  href,
  active,
  dotClass,
  count,
  children,
}: {
  href: string;
  active: boolean;
  /** Level colour dot (e.g. `bg-level-2`). */
  dotClass?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      scroll={false}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground border-transparent"
          : "bg-card text-foreground hover:bg-track",
      )}
    >
      {dotClass && <span aria-hidden className={cn("size-2 rounded-full", dotClass)} />}
      <span>{children}</span>
      {count !== undefined && (
        <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
          {count}
        </span>
      )}
    </Link>
  );
}
