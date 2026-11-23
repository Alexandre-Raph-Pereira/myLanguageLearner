import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/shell/page-title";
import { CsvImport } from "@/components/words/csv-import";
import { getWordContext } from "@/lib/words/context";

export const metadata: Metadata = { title: "Import words · LangLearner" };

export default async function ImportPage() {
  const { scope } = await getWordContext();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageTitle
        sub={
          <>
            Quizlet: Export → copy the text (tab between term and definition).{" "}
            <Link href="/words/import/photo" className="text-brass-text font-semibold">
              Import a notebook photo instead
            </Link>
          </>
        }
      >
        Import words
      </PageTitle>
      <CsvImport language={scope.language} />
    </div>
  );
}
