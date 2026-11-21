import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tests · LangLearner" };

const ENTRIES = [
  { title: "Word test", description: "25 due words, EN→KR by default.", plan: "01" },
  { title: "Grammar test", description: "5–20 questions on the lessons you pick.", plan: "03" },
  { title: "TOPIK test", description: "Blank or serious mode at your target level.", plan: "05" },
];

export default function TestsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tests</h1>
      <ul className="flex flex-col gap-3">
        {ENTRIES.map((e) => (
          <li key={e.title}>
            <Card aria-disabled className="opacity-70">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {e.title}
                  <Badge variant="outline">Coming in plan {e.plan}</Badge>
                </CardTitle>
                <CardDescription>{e.description}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
