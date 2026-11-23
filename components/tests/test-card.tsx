import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TestEntry } from "./test-catalog";

/** Test entry card: a link once its plan shipped; muted "Available after plan NN" before. */
export function TestCard({ entry, className }: { entry: TestEntry; className?: string }) {
  const Icon = entry.icon;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            entry.href ? "bg-primary text-primary-foreground" : "bg-track text-muted-foreground",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        {!entry.href && (
          <span className="text-muted-foreground border-border-strong rounded-full border border-dashed px-2.5 py-1 text-xs font-medium">
            Available after plan {entry.plan}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 id={`test-${entry.id}`} className="font-display text-xl font-medium">
          {entry.title}
        </h3>
        <p className="text-muted-foreground text-[13px]">{entry.description}</p>
      </div>
    </>
  );
  const base = "bg-card flex flex-col gap-3 rounded-2xl border p-4 md:p-5";
  if (entry.href) {
    return (
      <Link
        href={entry.href}
        aria-labelledby={`test-${entry.id}`}
        className={cn(base, "hover:bg-track/60 transition-colors", className)}
      >
        {body}
      </Link>
    );
  }
  return (
    <article data-disabled="" aria-labelledby={`test-${entry.id}`} className={cn(base, className)}>
      {body}
    </article>
  );
}

export type ResumeInfo = { href: string; title: string; sub: string };

/** Resume card for an unfinished test (empty state when there is none). */
export function ResumeSlot({ resume }: { resume?: ResumeInfo | null }) {
  if (resume) {
    return (
      <Link
        href={resume.href}
        data-slot="resume-test"
        className="bg-card hover:bg-track/60 flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors"
      >
        <span className="flex flex-col gap-1">
          <span className="overline-label">Resume</span>
          <span className="text-[15px] font-semibold">{resume.title}</span>
        </span>
        <span className="text-muted-foreground text-[13px] tabular-nums">{resume.sub}</span>
      </Link>
    );
  }
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
