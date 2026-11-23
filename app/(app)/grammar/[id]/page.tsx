import { ArrowLeft, Check, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExampleList } from "@/components/grammar/examples";
import { LessonMenu } from "@/components/grammar/lesson-menu";
import { ExamLevelChip } from "@/components/grammar/level-chip";
import { LessonMarkdown } from "@/components/grammar/markdown";
import { MasteryCard } from "@/components/grammar/mastery";
import { Button } from "@/components/ui/button";
import { T } from "@/components/ui/target-text";
import { getGrammarContext } from "@/lib/grammar/context";
import { todayFor } from "@/lib/grammar/credit";
import { creditedLessonIds, getGrammar } from "@/lib/grammar/queries";
import { LANGUAGE_EXAMS } from "@/lib/languages";
import { deleteGrammarAction, markStudiedAction } from "../actions";

export const metadata: Metadata = { title: "Grammar lesson · LangLearner" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LINK_LABELS = { similar: "Similar", contrast: "Contrast", prerequisite: "Prerequisite" };

export default async function GrammarLessonPage({ params }: PageProps<"/grammar/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { db, scope } = await getGrammarContext();
  const lesson = await getGrammar(db, scope, id);
  if (!lesson) notFound();
  const studied = (await creditedLessonIds(db, scope, await todayFor(db, scope.userId))).has(id);
  const exam = LANGUAGE_EXAMS[scope.language] ?? "Level";
  const lang = scope.language;

  return (
    <article className="flex max-w-2xl flex-col gap-4 pb-4">
      <Link
        href="/grammar"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] font-medium"
      >
        <ArrowLeft aria-hidden className="size-4" /> Grammar
      </Link>

      <header className="flex flex-col gap-2">
        <h1>
          <T lang={lang} className="text-[34px] leading-tight font-bold">
            {lesson.title}
          </T>
        </h1>
        <p className="font-display text-xl">{lesson.meaningShort}</p>
        <div className="flex flex-wrap items-center gap-2">
          <ExamLevelChip level={lesson.level} exam={exam} />
          {lesson.pattern !== lesson.title && (
            <T lang={lang} className="text-muted-foreground text-[14px]">
              {lesson.pattern}
            </T>
          )}
        </div>
        {lesson.variants.length > 0 && (
          <ul aria-label="Forms" className="flex flex-wrap gap-1.5">
            {lesson.variants.map((v) => (
              <li key={v}>
                <T lang={lang} className="bg-track rounded-full px-2.5 py-0.5 text-[13px]">
                  {v}
                </T>
              </li>
            ))}
          </ul>
        )}
      </header>

      <MasteryCard />

      {studied ? (
        <div
          className="bg-good-soft flex min-h-11 items-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-medium"
          data-testid="studied-today"
        >
          <Check aria-hidden className="size-4 shrink-0" />
          Studied today — counts as today&apos;s grammar lesson
        </div>
      ) : (
        <form action={markStudiedAction.bind(null, lesson.id)}>
          <Button type="submit" variant="outline" className="w-full">
            <Check aria-hidden /> Mark as studied today
          </Button>
        </form>
      )}

      {lesson.descriptionMd && (
        <section
          aria-label="Explanation"
          className="bg-card flex flex-col gap-2 rounded-2xl border p-4"
        >
          <h2 className="overline-label">Explanation</h2>
          <LessonMarkdown>{lesson.descriptionMd}</LessonMarkdown>
        </section>
      )}

      {lesson.formationMd && (
        <section
          aria-label="Formation"
          className="bg-card flex flex-col gap-2 rounded-2xl border p-4"
        >
          <h2 className="overline-label">Formation</h2>
          <LessonMarkdown>{lesson.formationMd}</LessonMarkdown>
        </section>
      )}

      {lesson.examples.length > 0 && (
        <section
          aria-label="Examples"
          className="bg-card flex flex-col gap-3 rounded-2xl border p-4"
        >
          <h2 className="overline-label">Examples</h2>
          <ExampleList
            examples={lesson.examples}
            patterns={[lesson.pattern, ...lesson.variants]}
            language={lang}
          />
        </section>
      )}

      {(lesson.similarMd || lesson.links.length > 0) && (
        <section
          aria-label="Similar · be careful"
          className="border-border-strong flex flex-col gap-3 rounded-2xl border border-dashed p-4"
        >
          <h2 className="overline-label">Similar · be careful</h2>
          {lesson.similarMd && <LessonMarkdown>{lesson.similarMd}</LessonMarkdown>}
          {lesson.links.length > 0 && (
            <ul aria-label="Related lessons" className="flex flex-wrap gap-2">
              {lesson.links.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/grammar/${l.id}`}
                    title={l.note ?? l.meaningShort}
                    className="bg-card hover:bg-track inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px]"
                  >
                    <T lang={lang} className="font-semibold">
                      {l.title}
                    </T>
                    <span className="text-muted-foreground">· {LINK_LABELS[l.kind]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link href={`/grammar/${lesson.id}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
        <Button disabled className="flex-1" title="Grammar tests arrive with plan 03">
          Test this lesson
        </Button>
        <LessonMenu title={lesson.title} onDelete={deleteGrammarAction.bind(null, lesson.id)} />
      </div>
    </article>
  );
}
