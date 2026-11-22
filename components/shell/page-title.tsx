import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page heading: Fraunces, 30 px mobile / 36 px desktop, optional sub line. */
export function PageTitle({
  children,
  sub,
  className,
}: {
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <h1 className="font-display text-[30px] leading-tight font-medium md:text-4xl">{children}</h1>
      {sub && <p className="text-muted-foreground text-[15px]">{sub}</p>}
    </div>
  );
}
