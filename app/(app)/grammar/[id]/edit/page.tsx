import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GrammarEdit } from "@/components/grammar/grammar-edit";
import { PageTitle } from "@/components/shell/page-title";
import { grammarCostInfo } from "@/lib/grammar/ai";
import { getGrammarContext } from "@/lib/grammar/context";
import { lessonToDraft } from "@/lib/grammar/drafts";
import { getGrammar, lessonOptions } from "@/lib/grammar/queries";
import { LANGUAGE_EXAMS } from "@/lib/languages";

export const metadata: Metadata = { title: "Edit lesson · LangLearner" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditGrammarPage({ params }: PageProps<"/grammar/[id]/edit">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { db, scope } = await getGrammarContext();
  const lesson = await getGrammar(db, scope, id);
  if (!lesson) notFound();
  const [lessons, cost] = await Promise.all([lessonOptions(db, scope), grammarCostInfo(db, scope)]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href={`/grammar/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] font-medium"
      >
        <ArrowLeft aria-hidden className="size-4" /> Back to the lesson
      </Link>
      <PageTitle>Edit lesson</PageTitle>
      <GrammarEdit
        lessonId={id}
        draft={lessonToDraft(lesson)}
        language={scope.language}
        exam={LANGUAGE_EXAMS[scope.language] ?? "Level"}
        lessons={lessons}
        cost={cost}
      />
    </div>
  );
}
