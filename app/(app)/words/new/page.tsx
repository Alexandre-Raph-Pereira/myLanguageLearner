import type { Metadata } from "next";
import { PageTitle } from "@/components/shell/page-title";
import { WordForm } from "@/components/words/word-form";
import { getWordContext } from "@/lib/words/context";
import { createWordAction } from "../actions";

export const metadata: Metadata = { title: "Add word · LangLearner" };

export default async function NewWordPage({ searchParams }: PageProps<"/words/new">) {
  const { scope } = await getWordContext();
  const { added } = await searchParams;
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <PageTitle>Add word</PageTitle>
      {added && (
        <p role="status" className="text-level-2-text text-[13px] font-semibold">
          Word saved. Add the next one.
        </p>
      )}
      <WordForm
        key={String(added ?? "")}
        action={createWordAction}
        language={scope.language}
        submitLabel="Save word"
        allowAddAnother
      />
    </div>
  );
}
