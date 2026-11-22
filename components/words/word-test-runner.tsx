"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import {
  answerWordAction,
  overrideAnswerAction,
  type AnswerResponse,
} from "@/app/(app)/tests/words/actions";
import { FeedbackPanel, ProgressBar } from "@/components/progress";
import { Button } from "@/components/ui/button";
import { T } from "@/components/ui/target-text";
import type { WordType } from "@/db/schema/words";
import { TARGET_FONT_CLASS, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { TYPE_LABELS } from "@/lib/words/filters";
import { describeNextReview } from "@/lib/words/scheduler";
import type { AnswerOutcome } from "@/lib/words/session";

export type RunnerItem = {
  direction: "en_ko" | "ko_en";
  type: WordType;
  /** en_ko: the meanings; ko_en: the term. */
  prompt: string[];
};

type Stats = { answered: number; correct: number; streak: number };

function verdictOf(o: AnswerOutcome): string {
  switch (o.result) {
    case "correct":
      return "Correct";
    case "alternative":
      return `Also right — ${o.alternativeTerm ?? "another word"} is in your bank`;
    case "override":
      return "Counted as correct";
    default:
      return "Not quite";
  }
}

/** One card at a time: prompt → typed answer → feedback (FeedbackPanel) → next. */
export function WordTestRunner({
  sessionId,
  language,
  items,
  startIndex,
  initialStats,
  initialGoal,
  showPoints,
}: {
  sessionId: string;
  language: Language;
  items: RunnerItem[];
  startIndex: number;
  initialStats: Stats;
  initialGoal: { words: number; goal: number };
  showPoints: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(startIndex);
  const [answer, setAnswer] = useState("");
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [goal, setGoal] = useState(initialGoal);
  const [error, setError] = useState<string | null>(null);
  const [addMeaning, setAddMeaning] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const total = items.length;
  const item = items[index];
  const answeredNow = stats.answered;

  useEffect(() => {
    if (outcome) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [outcome, index]);

  function apply(res: AnswerResponse, wasOverride: boolean) {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    const o = res.outcome;
    setOutcome(o);
    setGoal(o.goal);
    const right = o.result !== "wrong";
    setStats((s) =>
      wasOverride
        ? { ...s, correct: s.correct + 1, streak: s.streak + 1 }
        : {
            answered: s.answered + 1,
            correct: s.correct + (right ? 1 : 0),
            streak: right ? s.streak + 1 : 0,
          },
    );
  }

  function submit() {
    if (pending || outcome || !item) return;
    const value = answer.trim();
    if (!value) return;
    start(async () => apply(await answerWordAction(sessionId, index, value), false));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // IME: Enter while composing Hangul only commits the syllable.
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    submit();
  }

  function override() {
    if (!outcome || pending) return;
    start(async () => apply(await overrideAnswerAction(sessionId, index, addMeaning), true));
  }

  function next() {
    if (index + 1 >= total) {
      router.refresh();
      return;
    }
    setIndex(index + 1);
    setOutcome(null);
    setAnswer("");
    setAddMeaning(false);
  }

  const accuracy = answeredNow ? Math.round((stats.correct / answeredNow) * 100) : null;
  const position = Math.min(index + 1, total);
  const progressPct = (answeredNow / total) * 100;
  const typingTarget = item?.direction === "en_ko";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Quit test">
            <Link href="/tests">
              <X aria-hidden />
            </Link>
          </Button>
          <ProgressBar pct={progressPct} tone="brass" label="Test progress" className="flex-1" />
          <span className="text-[13px] font-semibold tabular-nums" data-testid="position">
            {position}/{total}
          </span>
        </div>
        <p className="text-muted-foreground text-[13px] tabular-nums" data-testid="session-stats">
          Streak {stats.streak} · Accuracy {accuracy === null ? "–" : `${accuracy} %`}
        </p>
      </header>

      {item && (
        <section
          aria-label="Question"
          className="bg-card flex flex-col gap-4 rounded-2xl border p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="overline-label">
              {item.direction === "en_ko" ? "Write in Korean" : "Write the meaning"}
            </span>
            <span className="bg-track text-muted-foreground rounded-sm px-1.5 py-0.5 text-[11px] font-medium">
              {TYPE_LABELS[item.type]}
            </span>
          </div>
          <p className="text-[26px] leading-snug font-semibold" data-testid="prompt">
            {item.direction === "en_ko" ? (
              item.prompt.join(", ")
            ) : (
              <T lang={language}>{item.prompt[0]}</T>
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-3"
          >
            <input
              ref={inputRef}
              aria-label="Your answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={onKeyDown}
              readOnly={!!outcome}
              lang={typingTarget ? language : "en"}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              className={cn(
                "bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-13 w-full rounded-xl border px-4 text-xl outline-none read-only:opacity-80 focus-visible:ring-3",
                typingTarget && TARGET_FONT_CLASS[language],
              )}
            />
            {!outcome && (
              <Button type="submit" size="lg" disabled={pending || !answer.trim()}>
                {pending ? "Checking…" : "Check"}
              </Button>
            )}
          </form>
        </section>
      )}

      {error && (
        <p role="alert" className="text-wrong-text text-[13px] font-semibold">
          {error}
        </p>
      )}

      {outcome && (
        <FeedbackPanel
          correct={outcome.result !== "wrong"}
          verdict={verdictOf(outcome)}
          expected={outcome.expected}
          language={outcome.direction === "en_ko" ? language : undefined}
          levelFrom={outcome.levelFrom}
          levelTo={outcome.levelTo}
          nextReview={
            outcome.result === "wrong" ? undefined : describeNextReview(outcome.intervalDays)
          }
          example={outcome.example ?? undefined}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            {outcome.becameKnown && <span className="text-level-2-text font-semibold">Known</span>}
            {outcome.result === "wrong" && (
              <span className="text-muted-foreground">Back in today&apos;s review</span>
            )}
            {showPoints && (
              <span className="text-brass-text font-semibold" data-testid="points-gained">
                +{outcome.points} pts
              </span>
            )}
            {outcome.result === "wrong" && (
              <span className="text-muted-foreground">
                You wrote{" "}
                {outcome.direction === "en_ko" ? (
                  <T lang={language} className="font-semibold">
                    {outcome.answer}
                  </T>
                ) : (
                  <span className="font-semibold">{outcome.answer}</span>
                )}
              </span>
            )}
          </div>
          {!outcome.example && (
            <p className="text-muted-foreground text-[13px]">No example sentence yet.</p>
          )}
          {outcome.result === "wrong" && (
            <div className="flex flex-col gap-2">
              {outcome.direction === "ko_en" && (
                <label className="flex min-h-11 items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={addMeaning}
                    onChange={(e) => setAddMeaning(e.target.checked)}
                    className="accent-primary size-5"
                  />
                  Add my answer as an accepted meaning
                </label>
              )}
              <Button
                variant="outline"
                onClick={override}
                disabled={pending}
                className="self-start"
              >
                I was right
              </Button>
            </div>
          )}
        </FeedbackPanel>
      )}

      {outcome && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold">Daily goal</span>
              <span className="text-muted-foreground tabular-nums" data-testid="goal-mini">
                {Math.min(goal.words, goal.goal)} / {goal.goal} words
              </span>
            </div>
            <ProgressBar
              pct={(goal.words / Math.max(goal.goal, 1)) * 100}
              tone="brass"
              size="sm"
              label="Daily goal"
            />
          </div>
          <Button ref={nextRef} size="lg" onClick={next} disabled={pending}>
            {index + 1 >= total ? "See results" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}
