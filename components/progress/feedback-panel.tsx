import { CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";
import { T } from "@/components/ui/target-text";
import type { Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { LevelTransition } from "./level-badge";

/** Answer feedback: correct (good-soft) / wrong (wrong-soft) with level change and example. */
export function FeedbackPanel({
  correct,
  verdict,
  expected,
  language,
  levelFrom,
  levelTo,
  nextReview,
  example,
  children,
  className,
}: {
  correct: boolean;
  /** Overrides the default "Correct" / "Not quite" heading. */
  verdict?: string;
  /** The expected answer (target-language text when `language` is set). */
  expected?: string;
  language?: Language;
  levelFrom?: number;
  levelTo?: number;
  /** e.g. "in 3 days". */
  nextReview?: string;
  example?: { text: string; translation?: string };
  /** Extra actions (e.g. "I was right"). */
  children?: ReactNode;
  className?: string;
}) {
  const Icon = correct ? CircleCheck : CircleX;
  const text = (s: string) => (language ? <T lang={language}>{s}</T> : s);
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4",
        correct ? "bg-good-soft text-foreground" : "bg-wrong-soft text-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden
          className={cn("size-5", correct ? "text-level-2-text" : "text-wrong-text")}
        />
        <span
          className={cn("text-[15px] font-bold", correct ? "text-level-2-text" : "text-wrong-text")}
        >
          {verdict ?? (correct ? "Correct" : "Not quite")}
        </span>
      </div>
      {expected && (
        <div className="flex flex-col gap-0.5">
          <span className="overline-label">Answer</span>
          <span className="text-xl font-semibold">{text(expected)}</span>
        </div>
      )}
      {(levelFrom !== undefined || nextReview) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          {levelFrom !== undefined && levelTo !== undefined && (
            <LevelTransition from={levelFrom} to={levelTo} />
          )}
          {nextReview && <span className="text-muted-foreground">Next review {nextReview}</span>}
        </div>
      )}
      {example && (
        <div className="border-foreground/10 flex flex-col gap-0.5 border-t pt-3">
          <span className="text-[15px]">{text(example.text)}</span>
          {example.translation && (
            <span className="text-muted-foreground text-[13px]">{example.translation}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
