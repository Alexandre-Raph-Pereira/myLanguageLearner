import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GrammarCard } from "@/components/grammar/grammar-card";
import { PageTitle } from "@/components/shell/page-title";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/words/filter-chip";
import { getGrammarContext } from "@/lib/grammar/context";
import { todayFor } from "@/lib/grammar/credit";
import { GRAMMAR_LEVELS, grammarHref, parseGrammarParams } from "@/lib/grammar/filters";
import { creditedLessonIds, listGrammar } from "@/lib/grammar/queries";
import { LANGUAGE_EXAMS } from "@/lib/languages";

export const metadata: Metadata = { title: "Grammar · LangLearner" };

export default async function GrammarPage({ searchParams }: PageProps<"/grammar">) {
  const { db, scope } = await getGrammarContext();
  const params = parseGrammarParams(await searchParams);
  const today = await todayFor(db, scope.userId);
  const [all, matching, studied] = await Promise.all([
    listGrammar(db, scope),
    params.q ? listGrammar(db, scope, { q: params.q }) : null,
    creditedLessonIds(db, scope, today),
  ]);
  const searched = matching ?? all;
  const rows = params.level === null ? searched : searched.filter((r) => r.level === params.level);
  const byLevel = new Map<number, number>();
  for (const r of searched) if (r.level) byLevel.set(r.level, (byLevel.get(r.level) ?? 0) + 1);
  const exam = LANGUAGE_EXAMS[scope.language] ?? "Level";
  const studiedCount = all.filter((r) => studied.has(r.id)).length;
  const filtered = params.q !== "" || params.level !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          sub={
            <span data-testid="grammar-summary">
              {all.length} {all.length === 1 ? "lesson" : "lessons"} · {studiedCount} studied today
            </span>
          }
        >
          Grammar
        </PageTitle>
        <Button asChild>
          <Link href="/grammar/new">
            <Plus aria-hidden /> Add lesson
          </Link>
        </Button>
      </div>

      <form action="/grammar" method="get" role="search" className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Search patterns or meanings"
          aria-label="Search grammar"
          autoComplete="off"
          className="bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-3 pl-9 text-[15px] outline-none focus-visible:ring-3"
        />
        {params.level !== null && <input type="hidden" name="level" value={params.level} />}
      </form>

      <div
        aria-label="Filter by level"
        role="group"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        <FilterChip
          href={grammarHref(params, { level: null })}
          active={params.level === null}
          count={searched.length}
        >
          All
        </FilterChip>
        {GRAMMAR_LEVELS.map((l) => (
          <FilterChip
            key={l}
            href={grammarHref(params, { level: params.level === l ? null : l })}
            active={params.level === l}
            count={byLevel.get(l) ?? 0}
          >
            {exam} {l}
          </FilterChip>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="border-border-strong flex flex-col items-start gap-2 rounded-2xl border border-dashed p-5">
          <span className="text-[15px] font-semibold">
            {filtered ? "No lessons match these filters" : "Your grammar library is empty"}
          </span>
          <span className="text-muted-foreground text-[13px]">
            {filtered
              ? "Try another search or clear the filters."
              : "Write a lesson, paste your notes, or photograph a notebook page."}
          </span>
          {!filtered && (
            <Button asChild variant="outline" className="mt-1">
              <Link href="/grammar/new">Add your first lesson</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul
          aria-label="Grammar lessons"
          className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
        >
          {rows.map((r) => (
            <li key={r.id}>
              <GrammarCard
                lesson={r}
                language={scope.language}
                exam={exam}
                studiedToday={studied.has(r.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
