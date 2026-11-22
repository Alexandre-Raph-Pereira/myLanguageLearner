import type { Metadata } from "next";
import { PageTitle } from "@/components/shell/page-title";
import { PhotoImport } from "@/components/words/photo-import";
import { getWordContext } from "@/lib/words/context";

export const metadata: Metadata = { title: "Import from photo · LangLearner" };

export default async function PhotoImportPage() {
  const { scope } = await getWordContext();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageTitle sub="Photograph a notebook page; review every row before saving.">
        Import from photo
      </PageTitle>
      <PhotoImport language={scope.language} />
    </div>
  );
}
