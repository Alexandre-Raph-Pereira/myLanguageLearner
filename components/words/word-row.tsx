import Link from "next/link";
import { LevelPips } from "@/components/progress";
import { T } from "@/components/ui/target-text";
import type { Word } from "@/db/schema/words";
import type { Language } from "@/lib/languages";
import { TYPE_LABELS } from "@/lib/words/filters";

/** One library row: term (target font), primary meaning, type chip, level pips, "no example" flag. */
export function WordRow({ word, language }: { word: Word; language: Language }) {
  return (
    <Link
      href={`/words/${word.id}`}
      className="hover:bg-track/60 flex items-center gap-3 px-4 py-3 transition-colors"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <T lang={language} className="truncate text-lg font-semibold">
            {word.term}
          </T>
          <span className="bg-track text-muted-foreground shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-medium">
            {TYPE_LABELS[word.type]}
          </span>
        </div>
        <div className="flex min-w-0 items-baseline gap-2 text-[13px]">
          <span className="text-muted-foreground truncate">{word.meanings.join(", ")}</span>
          {word.exampleSentence === null && (
            <span className="text-level-1-text shrink-0 font-semibold">no example</span>
          )}
        </div>
      </div>
      <LevelPips level={word.level} className="shrink-0" />
    </Link>
  );
}
