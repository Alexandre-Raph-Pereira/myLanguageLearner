import type { Metadata } from "next";
import { PageTitle } from "@/components/shell/page-title";
import { WordTestParams } from "@/components/words/word-test-params";
import { getWordContext } from "@/lib/words/context";
import { candidateStats, latestOpenSession } from "@/lib/words/session";
import Link from "next/link";

export const metadata: Metadata = { title: "Word test · LangLearner" };

export default async function WordTestParamsPage() {
  const { db, scope } = await getWordContext();
  const [stats, open] = await Promise.all([
    candidateStats(db, scope),
    latestOpenSession(db, scope),
  ]);
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <PageTitle sub="Spaced repetition on your word bank.">Word test</PageTitle>
      {open && (
        <Link
          href={`/tests/words/${open.id}`}
          className="bg-card hover:bg-track/60 flex items-center justify-between gap-3 rounded-2xl border p-4"
        >
          <span className="flex flex-col">
            <span className="overline-label">Resume</span>
            <span className="text-[15px] font-semibold">Unfinished word test</span>
          </span>
          <span className="text-muted-foreground text-[13px] tabular-nums">
            {open.answered} / {open.total}
          </span>
        </Link>
      )}
      <WordTestParams stats={stats} />
    </div>
  );
}
