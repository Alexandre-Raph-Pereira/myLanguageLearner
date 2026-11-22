import { PageTitle } from "@/components/shell/page-title";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Grammar · LangLearner" };

export default function GrammarPage() {
  return (
    <div className="flex flex-col gap-2">
      <PageTitle>Grammar</PageTitle>
      <p className="text-muted-foreground text-[15px]">The grammar library arrives with plan 02.</p>
    </div>
  );
}
