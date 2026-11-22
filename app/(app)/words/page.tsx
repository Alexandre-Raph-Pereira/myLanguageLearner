import type { Metadata } from "next";

export const metadata: Metadata = { title: "Words · LangLearner" };

export default function WordsPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Words</h1>
      <p className="text-muted-foreground text-sm">The word bank arrives with plan 01.</p>
    </div>
  );
}
