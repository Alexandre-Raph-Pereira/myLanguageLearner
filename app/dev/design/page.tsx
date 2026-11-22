import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  FeedbackPanel,
  GoalMetBanner,
  GoalRing,
  HeroPanel,
  LedgerRow,
  LevelBadge,
  LevelBar,
  LevelPips,
  LevelTransition,
  MilestoneBadge,
  MiniBars,
  PointsBreakdown,
  ProgressBar,
  ProgressRing,
  StatTile,
  WeekStrip,
  type WeekDay,
} from "@/components/progress";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { T } from "@/components/ui/target-text";
import { BASE_TOKENS, type ThemeName } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Design system · LangLearner" };

const WEEK: WeekDay[] = [
  { label: "M", name: "Monday", status: "met" },
  { label: "T", name: "Tuesday", status: "met" },
  { label: "W", name: "Wednesday", status: "missed" },
  { label: "T", name: "Thursday", status: "met" },
  { label: "F", name: "Friday", status: "today", pct: 55 },
  { label: "S", name: "Saturday", status: "future" },
  { label: "S", name: "Sunday", status: "future" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="overline-label">{title}</h2>
      {children}
    </section>
  );
}

function Swatches({ theme }: { theme: ThemeName }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Object.entries(BASE_TOKENS[theme]).map(([name, hex]) => (
        <div key={name} className="flex flex-col gap-1 text-[11px]">
          <span className="h-8 rounded-md border" style={{ background: `var(--${name})` }} />
          <span className="truncate font-semibold">{name}</span>
          <span className="text-muted-foreground">{hex}</span>
        </div>
      ))}
    </div>
  );
}

function Column({ theme }: { theme: ThemeName }) {
  return (
    <div className={cn(theme, "bg-background text-foreground flex flex-col gap-8 p-4 md:p-8")}>
      <div className="flex items-center justify-between">
        <Wordmark />
        <span className="overline-label">{theme}</span>
      </div>

      <Section title="Typography">
        <p className="font-display text-[40px] leading-none font-medium">84%</p>
        <p className="font-display text-3xl font-medium">Page title</p>
        <p className="text-base">Body text in Inter, 16 px.</p>
        <p className="text-muted-foreground text-[13px]">Secondary text, muted.</p>
        <p className="text-2xl">
          <T lang="ko">한국어를 공부해요</T>
        </p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Start test</Button>
          <Button variant="outline">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
        </div>
      </Section>

      <Section title="HeroPanel + GoalRing">
        <HeroPanel aria-label={`Hero ${theme}`} className="flex items-center gap-5">
          <GoalRing words={{ done: 14, goal: 20 }} lessons={{ done: 1, goal: 1 }} size={116} />
          <div className="flex flex-col gap-2">
            <span className="text-sm opacity-80">Today</span>
            <span className="font-display text-xl">14 / 20 words · 1 / 1 lesson</span>
          </div>
        </HeroPanel>
        <GoalMetBanner streak={6} />
      </Section>

      <Section title="ProgressRing">
        <div className="flex flex-wrap gap-4">
          <ProgressRing pct={32} label="Score" />
          <ProgressRing pct={52} label="Score" />
          <ProgressRing pct={72} label="Score" sub="18 / 25" />
          <ProgressRing pct={92} label="Score" />
          <ProgressRing pct={0} step="muted" label="Mastery" />
        </div>
      </Section>

      <Section title="ProgressBar · LevelBar · MiniBars">
        <div className="bg-card flex flex-col gap-4 rounded-2xl border p-4">
          {[25, 50, 70, 95].map((p) => (
            <div key={p} className="flex items-center gap-3">
              <ProgressBar pct={p} label={`${p}%`} />
              <span className="w-10 text-right text-sm tabular-nums">{p}%</span>
            </div>
          ))}
          <LevelBar counts={[42, 118, 210, 95]} />
          <MiniBars
            values={[35, 48, 52, 61, 58, 70, 66, 74, 81, 77, 85, 90].map((pct) => ({ pct }))}
          />
        </div>
      </Section>

      <Section title="Levels">
        <div className="flex flex-wrap items-center gap-3">
          {[0, 1, 2, 3].map((l) => (
            <LevelBadge key={l} level={l} />
          ))}
          <LevelBadge level={2} showLabel />
          <LevelTransition from={1} to={2} />
        </div>
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((l) => (
            <LevelPips key={l} level={l} />
          ))}
        </div>
      </Section>

      <Section title="LedgerRow · StatTile">
        <div className="bg-card divide-y rounded-2xl border px-4">
          <LedgerRow name="Words known" sub="325 of 465" pct={70} delta={4} />
          <LedgerRow name="Grammar mastered" sub="6 of 22 lessons" pct={27} delta={-2} />
          <LedgerRow name="TOPIK reading" sub="Not tested yet" pct={null} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Streak" value="12" sub="Best 30 days" />
          <StatTile
            label="Points"
            value="4,820"
            sub="Elementary I"
            valueClassName="text-brass-text"
          />
        </div>
      </Section>

      <Section title="WeekStrip">
        <WeekStrip days={WEEK} />
      </Section>

      <Section title="Milestones · Points">
        <div className="flex flex-wrap gap-3">
          <MilestoneBadge title="50 words" sub="known" earned />
          <MilestoneBadge title="100 words" sub="known" earned={false} pct={64} />
          <MilestoneBadge title="7-day streak" earned={false} pct={86} />
        </div>
        <div className="bg-card rounded-2xl border px-4 py-2">
          <PointsBreakdown
            lines={[
              { label: "18 correct answers", points: 180 },
              { label: "2 words became known", points: 10 },
              { label: "Daily goal met", points: 25 },
            ]}
          />
        </div>
      </Section>

      <Section title="FeedbackPanel">
        <FeedbackPanel
          correct
          expected="도서관"
          language="ko"
          levelFrom={1}
          levelTo={2}
          nextReview="in 3 days"
          example={{ text: "도서관에서 책을 읽어요.", translation: "I read books at the library." }}
        />
        <FeedbackPanel
          correct={false}
          expected="약속"
          language="ko"
          levelFrom={2}
          levelTo={0}
          nextReview="now"
        />
      </Section>

      <Section title="Tokens">
        <Swatches theme={theme} />
      </Section>
    </div>
  );
}

/** Dev-only style sheet: every component in light and dark side by side. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="grid flex-1 md:grid-cols-2">
      <h1 className="sr-only">Design system</h1>
      <Column theme="light" />
      <Column theme="dark" />
    </main>
  );
}
