import { PageTitle } from "@/components/shell/page-title";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TESTS = [
  { title: "Word test", description: "Spaced-repetition review of your word bank.", plan: "01" },
  { title: "Grammar test", description: "AI-generated questions on chosen lessons.", plan: "03" },
  { title: "TOPIK test", description: "Exam-style practice built from your library.", plan: "05" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Home</PageTitle>

      <Card className="border-dashed" data-slot="resume-test">
        <CardHeader>
          <CardTitle className="text-base">No unfinished test</CardTitle>
          <CardDescription>
            An unfinished test will appear here so you can resume it.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {TESTS.map((t) => (
          <Card key={t.title} aria-disabled className="opacity-70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {t.title}
                <Badge variant="outline">Soon</Badge>
              </CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        Set your target TOPIK level and AI budgets in{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
