import { Camera, FileUp, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroPanel, LevelBar } from "@/components/progress";
import { PageTitle } from "@/components/shell/page-title";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/words/filter-chip";
import { WordRow } from "@/components/words/word-row";
import { WORD_TYPES } from "@/db/schema/words";
import { stepClasses } from "@/lib/progress/scale";
import { getWordContext } from "@/lib/words/context";
import {
  libraryHref,
  PAGE_SIZE,
  parseLibraryParams,
  toFilters,
  TYPE_LABELS,
} from "@/lib/words/filters";
import { listWords, wordStats } from "@/lib/words/queries";
import { todayWordGoal } from "@/lib/words/today";

export const metadata: Metadata = { title: "Words · LangLearner" };

const LEVELS = [0, 1, 2, 3] as const;

export default async function WordsPage({ searchParams }: PageProps<"/words">) {
  const { db, scope } = await getWordContext();
  const params = parseLibraryParams(await searchParams);
  const [stats, list, goal] = await Promise.all([
    wordStats(db, scope),
    listWords(db, scope, toFilters(params), {
      limit: PAGE_SIZE,
      offset: (params.page - 1) * PAGE_SIZE,
    }),
    todayWordGoal(db, scope),
  ]);
  const knownPct = stats.total ? Math.round((stats.known / stats.total) * 100) : 0;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const filtered = params.q || params.level !== null || params.type || params.noExample;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          sub={
            <span data-testid="words-summary">
              {stats.total} words · {stats.known} known ({knownPct} %)
            </span>
          }
        >
          Words
        </PageTitle>
        <nav aria-label="Word actions" className="flex flex-wrap gap-2">
          <Button asChild size="default">
            <Link href="/words/new">
              <Plus aria-hidden /> Add
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/words/import">
              <FileUp aria-hidden /> Import CSV
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/words/import/photo">
              <Camera aria-hidden /> Import photo
            </Link>
          </Button>
        </nav>
      </div>

      {stats.total > 0 && <LevelBar counts={stats.byLevel} />}

      <HeroPanel aria-label="Due words" className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-display text-2xl font-medium" data-testid="due-count">
            {stats.due} {stats.due === 1 ? "word" : "words"} due
          </span>
          <span className="text-[13px] opacity-75">
            Today&apos;s goal {Math.min(goal.words, goal.goal)} / {goal.goal} words
          </span>
        </div>
        <Link
          href="/tests/words"
          className="bg-on-hero text-hero inline-flex h-12 items-center justify-center rounded-xl px-6 text-[15px] font-semibold"
        >
          Start test
        </Link>
      </HeroPanel>

      <form action="/words" method="get" role="search" className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Search words or meanings"
          aria-label="Search words"
          autoComplete="off"
          className="bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-3 pl-9 text-[15px] outline-none focus-visible:ring-3"
        />
        {params.level !== null && <input type="hidden" name="level" value={params.level} />}
        {params.type && <input type="hidden" name="type" value={params.type} />}
        {params.noExample && <input type="hidden" name="noex" value="1" />}
      </form>

      <div className="flex flex-col gap-2">
        <div
          aria-label="Filter by level"
          role="group"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
        >
          <FilterChip
            href={libraryHref(params, { level: null, noExample: false })}
            active={params.level === null && !params.noExample}
            count={stats.total}
          >
            All
          </FilterChip>
          {LEVELS.map((l) => (
            <FilterChip
              key={l}
              href={libraryHref(params, { level: params.level === l ? null : l })}
              active={params.level === l}
              dotClass={stepClasses(l).fill}
              count={stats.byLevel[l]}
            >
              Lv {l}
            </FilterChip>
          ))}
          <FilterChip
            href={libraryHref(params, { noExample: !params.noExample })}
            active={params.noExample}
            dotClass="bg-level-1"
            count={stats.needsExample}
          >
            No example
          </FilterChip>
        </div>
        <div
          aria-label="Filter by type"
          role="group"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
        >
          {WORD_TYPES.filter((t) => (stats.byType[t] ?? 0) > 0).map((t) => (
            <FilterChip
              key={t}
              href={libraryHref(params, { type: params.type === t ? null : t })}
              active={params.type === t}
              count={stats.byType[t]}
            >
              {TYPE_LABELS[t]}
            </FilterChip>
          ))}
        </div>
      </div>

      {list.rows.length === 0 ? (
        <div className="border-border-strong flex flex-col items-start gap-2 rounded-2xl border border-dashed p-5">
          <span className="text-[15px] font-semibold">
            {filtered ? "No words match these filters" : "Your word bank is empty"}
          </span>
          <span className="text-muted-foreground text-[13px]">
            {filtered
              ? "Try another search or clear the filters."
              : "Add a word, or import your Quizlet export or a notebook photo."}
          </span>
        </div>
      ) : (
        <ul aria-label="Word list" className="bg-card divide-y overflow-hidden rounded-2xl border">
          {list.rows.map((w) => (
            <li key={w.id}>
              <WordRow word={w} language={scope.language} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {params.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={libraryHref(params, { page: params.page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-[13px] tabular-nums">
            Page {params.page} of {pages} · {list.total} words
          </span>
          {params.page < pages ? (
            <Button asChild variant="outline">
              <Link href={libraryHref(params, { page: params.page + 1 })}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
