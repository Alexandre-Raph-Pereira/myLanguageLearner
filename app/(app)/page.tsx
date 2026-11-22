import Link from "next/link";
import { GoalRing, HeroPanel, LedgerRow, ProgressBar, WeekStrip } from "@/components/progress";
import { PageTitle } from "@/components/shell/page-title";
import { TEST_ENTRIES } from "@/components/tests/test-catalog";
import { ResumeSlot, TestCard } from "@/components/tests/test-card";
import { emptyHomeData } from "./home-empty-state";

const fmt = (n: number) => n.toLocaleString("en-US");

function CardShell({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`bg-card flex flex-col gap-3 rounded-2xl border p-4 md:p-5 ${className}`}
    >
      <h2 className="overline-label">{title}</h2>
      {children}
    </section>
  );
}

export default function HomePage() {
  const data = emptyHomeData();
  const { goal, rank } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Home</PageTitle>

      <HeroPanel aria-label="Daily goal" className="flex flex-col gap-5">
        <div className="flex items-center gap-5">
          <GoalRing words={goal.words} lessons={goal.lessons} size={112} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-[0.08em] uppercase opacity-75">
              Today
            </span>
            <p className="font-display text-xl leading-snug md:text-2xl">
              Your daily goal: {goal.words.goal} words · {goal.lessons.goal} grammar lesson
            </p>
            <p className="text-[13px] opacity-75">
              {goal.words.done} / {goal.words.goal} words · {goal.lessons.done} /{" "}
              {goal.lessons.goal} lesson · streak {data.streak} days
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled
            className="bg-on-hero text-hero h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60 md:w-auto md:self-start md:px-6"
          >
            Start word test
          </button>
          <span className="text-xs opacity-75">Available after plan 01</span>
        </div>
      </HeroPanel>

      <div className="grid items-start gap-4 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        <CardShell title="This week">
          <WeekStrip days={data.week} />
        </CardShell>

        <CardShell title="Rank">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-2xl font-medium">{rank.name}</span>
            <span className="text-brass-text text-[15px] font-semibold tabular-nums">
              {fmt(rank.points)} pts
            </span>
          </div>
          <ProgressBar
            pct={(rank.points / rank.nextAt) * 100}
            tone="brass"
            size="sm"
            label={`Progress to ${rank.nextName}`}
          />
          <span className="text-muted-foreground text-[13px]">
            {fmt(rank.nextAt - rank.points)} pts to {rank.nextName} · points start with plan{" "}
            {rank.availableAfter}
          </span>
        </CardShell>

        <CardShell title="Progress">
          <div className="divide-y">
            {data.ledger.map((row) => (
              <LedgerRow key={row.name} name={row.name} sub={row.sub} pct={row.pct} />
            ))}
          </div>
        </CardShell>
      </div>

      <section aria-labelledby="home-tests" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="home-tests" className="font-display text-xl font-medium">
            Tests
          </h2>
          <Link href="/tests" className="text-brass-text text-sm font-semibold">
            All tests
          </Link>
        </div>
        <ResumeSlot />
        <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {TEST_ENTRIES.map((t) => (
            <TestCard key={t.id} entry={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
