import { PageTitle } from "@/components/shell/page-title";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Words · LangLearner" };

export default function WordsPage() {
  return (
    <div className="flex flex-col gap-2">
      <PageTitle>Words</PageTitle>
      <p className="text-muted-foreground text-[15px]">The word bank arrives with plan 01.</p>
    </div>
  );
}
