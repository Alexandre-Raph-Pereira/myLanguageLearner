import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GrammarImportClient } from "@/components/grammar/grammar-import-client";
import { PageTitle } from "@/components/shell/page-title";
import { grammarCostInfo } from "@/lib/grammar/ai";
import { getGrammarContext } from "@/lib/grammar/context";
import { lessonOptions } from "@/lib/grammar/queries";
import { LANGUAGE_EXAMS } from "@/lib/languages";

export const metadata: Metadata = { title: "Add grammar · LangLearner" };

export default async function NewGrammarPage() {
  const { db, scope } = await getGrammarContext();
  const [lessons, cost] = await Promise.all([lessonOptions(db, scope), grammarCostInfo(db, scope)]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href="/grammar"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] font-medium"
      >
        <ArrowLeft aria-hidden className="size-4" /> Grammar
      </Link>
      <PageTitle sub="Write it, paste your notes, or photograph your notebook.">
        Add a lesson
      </PageTitle>
      {cost.rates === null && (
        <p role="alert" className="bg-wrong-soft text-wrong-text rounded-xl p-3 text-sm">
          No price is set for the AI model {cost.model}, so AI features are blocked.{" "}
          <Link href="/settings" className="font-medium underline">
            Add it in Settings
          </Link>
          .
        </p>
      )}
      <GrammarImportClient
        language={scope.language}
        exam={LANGUAGE_EXAMS[scope.language] ?? "Level"}
        lessons={lessons}
        cost={cost}
      />
    </div>
  );
}
