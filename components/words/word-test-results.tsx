import Link from "next/link";
import { LevelBar, SessionSummary } from "@/components/progress";
import { Button } from "@/components/ui/button";
import { T } from "@/components/ui/target-text";
import type { Language } from "@/lib/languages";
import { scaleStep, stepClasses } from "@/lib/progress/scale";
import { cn } from "@/lib/utils";
import type { WordSessionResults } from "@/lib/words/session";

/** End screen (canvas "Session results"). */
export function WordTestResults({
  results: r,
  language,
  showPoints,
  celebrateMilestones,
  retry,
}: {
  results: WordSessionResults;
  language: Language;
  showPoints: boolean;
  celebrateMilestones: boolean;
  retry: () => Promise<void>;
}) {
  const step = scaleStep(r.pct);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <section aria-label="Score" className="flex flex-col items-center gap-1 py-2 text-center">
        <span className="overline-label">Word test</span>
        <span
          className={cn(
            "font-display text-[88px] leading-none font-medium",
            stepClasses(step).text,
          )}
          data-testid="score-pct"
        >
          {r.pct}%
        </span>
        <span className="text-muted-foreground text-[15px]" data-testid="score-count">
          {r.correct} of {r.total} correct
        </span>
      </section>

      <SessionSummary
        result={r.activity}
        showPoints={showPoints}
        celebrateMilestones={celebrateMilestones}
      >
        <section
          aria-label="Level movement"
          className="bg-card flex flex-col gap-4 rounded-2xl border p-4 md:p-5"
        >
          <h2 className="overline-label">Level movement</h2>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Before</span>
            <LevelBar counts={r.levelsBefore} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">After</span>
            <LevelBar counts={r.levelsAfter} />
          </div>
        </section>

        {r.missed.length > 0 && (
          <section
            aria-label="Missed words"
            className="bg-card flex flex-col gap-2 rounded-2xl border p-4 md:p-5"
          >
            <h2 className="overline-label">Missed · {r.missed.length}</h2>
            <ul className="divide-y">
              {r.missed.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/words/${m.id}`}
                    className="flex items-baseline justify-between gap-3 py-2.5"
                  >
                    <T lang={language} className="text-lg font-semibold">
                      {m.term}
                    </T>
                    <span className="text-muted-foreground truncate text-[13px]">
                      {m.meanings.join(", ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </SessionSummary>

      <div className="flex flex-col gap-2">
        {r.missed.length > 0 && (
          <form action={retry}>
            <Button type="submit" size="lg" className="w-full">
              Retry the {r.missed.length} missed {r.missed.length === 1 ? "word" : "words"}
            </Button>
          </form>
        )}
        <Button asChild size="lg" variant={r.missed.length > 0 ? "outline" : "default"}>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
