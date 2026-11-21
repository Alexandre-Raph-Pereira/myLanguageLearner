import type { Metadata } from "next";

export const metadata: Metadata = { title: "Grammar · LangLearner" };

export default function GrammarPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Grammar</h1>
      <p className="text-muted-foreground text-sm">The grammar library arrives with plan 02.</p>
    </div>
  );
}
