import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LevelBadge } from "@/components/progress";
import { PageTitle } from "@/components/shell/page-title";
import { Button } from "@/components/ui/button";
import { T } from "@/components/ui/target-text";
import { DeleteWordButton } from "@/components/words/delete-word-button";
import { WordForm } from "@/components/words/word-form";
import { getWordContext } from "@/lib/words/context";
import { getWord } from "@/lib/words/queries";
import { dueLabel, isKnown } from "@/lib/words/scheduler";
import { deleteWordAction, resetWordLevelAction, updateWordAction } from "../actions";

export const metadata: Metadata = { title: "Edit word · LangLearner" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditWordPage({ params }: PageProps<"/words/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { db, scope } = await getWordContext();
  const word = await getWord(db, scope, id);
  if (!word) notFound();
  const now = new Date();

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <PageTitle>
        <T lang={scope.language}>{word.term}</T>
      </PageTitle>

      <section aria-label="Level" className="bg-card flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LevelBadge level={word.level} showLabel />
            <span className="text-muted-foreground text-[13px]">{dueLabel(word.dueAt, now)}</span>
          </div>
          {word.level > 0 && (
            <form action={resetWordLevelAction.bind(null, word.id)}>
              <Button type="submit" variant="outline" size="default">
                Reset to Lv 0
              </Button>
            </form>
          )}
        </div>
        <p className="text-muted-foreground text-[13px] tabular-nums">
          {word.timesCorrect} correct · {word.timesFailed} wrong
          {isKnown(word) ? " · known" : ""}
        </p>
      </section>

      <WordForm
        action={updateWordAction.bind(null, word.id)}
        word={word}
        language={scope.language}
        submitLabel="Save changes"
      />

      <div className="border-t pt-4">
        <DeleteWordButton term={word.term} onDelete={deleteWordAction.bind(null, word.id)} />
      </div>
    </div>
  );
}
