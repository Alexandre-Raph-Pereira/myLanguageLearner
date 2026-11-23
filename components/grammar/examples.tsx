import { T } from "@/components/ui/target-text";
import type { GrammarExample } from "@/db/schema/grammar";
import { highlight } from "@/lib/grammar/highlight";
import type { Language } from "@/lib/languages";

/** Example sentences (target font) with the pattern occurrence in bold brass, translation below. */
export function ExampleList({
  examples,
  patterns,
  language,
}: {
  examples: GrammarExample[];
  patterns: string[];
  language: Language;
}) {
  return (
    <ol className="flex flex-col divide-y">
      {examples.map((e, i) => (
        <li key={i} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <T lang={language} className="text-[17px] leading-snug">
            {highlight(e.sentence, patterns).map((seg, j) =>
              seg.match ? (
                <strong key={j} className="text-brass-text font-bold">
                  {seg.text}
                </strong>
              ) : (
                <span key={j}>{seg.text}</span>
              ),
            )}
          </T>
          {e.translation && (
            <span className="text-muted-foreground text-[14px]">{e.translation}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
