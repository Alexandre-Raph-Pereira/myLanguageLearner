import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WordTestResults } from "@/components/words/word-test-results";
import { WordTestRunner, type RunnerItem } from "@/components/words/word-test-runner";
import { getWordContext } from "@/lib/words/context";
import { getWordsByIds } from "@/lib/words/queries";
import { getSessionResults, getWordSession } from "@/lib/words/session";
import { todayWordGoal } from "@/lib/words/today";
import { retryMissedAction } from "../actions";

export const metadata: Metadata = { title: "Word test · LangLearner" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WordSessionPage({ params }: PageProps<"/tests/words/[sessionId]">) {
  const { sessionId } = await params;
  if (!UUID.test(sessionId)) notFound();
  const { db, scope, settings } = await getWordContext();
  const state = await getWordSession(db, scope, sessionId);
  if (!state) notFound();

  if (state.nextIndex >= state.items.length || state.session.status === "finished") {
    const results = await getSessionResults(db, scope, state);
    return (
      <WordTestResults
        results={results}
        language={scope.language}
        showPoints={settings.showPoints}
        celebrateMilestones={settings.celebrateMilestones}
        retry={retryMissedAction.bind(null, sessionId)}
      />
    );
  }

  if (state.session.status === "abandoned") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <p className="text-[15px] font-semibold">This test was replaced by a newer one.</p>
        <Button asChild className="self-start">
          <Link href="/tests/words">New word test</Link>
        </Button>
      </div>
    );
  }

  const words = new Map(
    (
      await getWordsByIds(
        db,
        scope,
        state.items.map((i) => i.wordId),
      )
    ).map((w) => [w.id, w]),
  );
  // Deleted words are skipped (they cannot be answered).
  const items: RunnerItem[] = state.items.map((it) => {
    const w = words.get(it.wordId);
    return {
      direction: it.direction,
      type: w?.type ?? "other",
      prompt: w ? (it.direction === "en_ko" ? w.meanings : [w.term]) : ["(deleted word)"],
    };
  });
  const answered = state.items.filter((it) => state.reviews.has(it.wordId));
  let streak = 0;
  for (const it of answered) {
    streak = state.reviews.get(it.wordId)?.result === "wrong" ? 0 : streak + 1;
  }
  const goal = await todayWordGoal(db, scope);

  return (
    <WordTestRunner
      sessionId={sessionId}
      language={scope.language}
      items={items}
      startIndex={state.nextIndex}
      initialStats={{
        answered: answered.length,
        correct: answered.filter((it) => state.reviews.get(it.wordId)?.result !== "wrong").length,
        streak,
      }}
      initialGoal={{ words: goal.words, goal: goal.goal }}
      showPoints={settings.showPoints}
    />
  );
}
