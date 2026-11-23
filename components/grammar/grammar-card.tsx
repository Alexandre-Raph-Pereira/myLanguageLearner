import { Check } from "lucide-react";
import Link from "next/link";
import { T } from "@/components/ui/target-text";
import type { Language } from "@/lib/languages";
import { ExamLevelChip } from "./level-chip";
import { MasteryBadge } from "./mastery";

/** Library card: title (target font), meaning, level chip, mastery slot, studied-today tick. */
export function GrammarCard({
  lesson,
  language,
  exam,
  studiedToday,
}: {
  lesson: { id: string; title: string; meaningShort: string; level: number | null };
  language: Language;
  exam?: string;
  studiedToday: boolean;
}) {
  return (
    <Link
      href={`/grammar/${lesson.id}`}
      className="bg-card hover:bg-track/40 flex h-full flex-col gap-2 rounded-2xl border p-4 transition-colors"
      data-testid="grammar-card"
    >
      <div className="flex items-start justify-between gap-2">
        <T lang={language} className="text-xl leading-snug font-semibold">
          {lesson.title}
        </T>
        {studiedToday && (
          <span
            className="bg-good-soft text-foreground inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold"
            title="Studied today"
          >
            <Check aria-hidden className="size-3.5" /> Today
          </span>
        )}
      </div>
      <span className="text-muted-foreground text-[14px]">{lesson.meaningShort}</span>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <ExamLevelChip level={lesson.level} exam={exam} />
        <MasteryBadge />
      </div>
    </Link>
  );
}
