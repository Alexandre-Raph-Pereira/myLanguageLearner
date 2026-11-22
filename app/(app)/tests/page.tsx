import type { Metadata } from "next";
import { PageTitle } from "@/components/shell/page-title";
import { TEST_ENTRIES } from "@/components/tests/test-catalog";
import { ResumeSlot, TestCard } from "@/components/tests/test-card";

export const metadata: Metadata = { title: "Tests · LangLearner" };

export default function TestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle sub="Words, grammar and exam practice built from your library.">Tests</PageTitle>
      <ResumeSlot />
      <ul className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] md:gap-4">
        {TEST_ENTRIES.map((e) => (
          <li key={e.id}>
            <TestCard entry={e} className="h-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
