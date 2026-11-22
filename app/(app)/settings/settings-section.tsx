import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Settings section: overline heading above a card. */
export function SettingsSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `settings-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-4 flex-col gap-2">
      <h2 id={headingId} className="overline-label px-1">
        {title}
      </h2>
      <div className={cn("bg-card flex flex-col gap-4 rounded-2xl border p-4 md:p-5", className)}>
        {description && <p className="text-muted-foreground text-[13px]">{description}</p>}
        {children}
      </div>
    </section>
  );
}
