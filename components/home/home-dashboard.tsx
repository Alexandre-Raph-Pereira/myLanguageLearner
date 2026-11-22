import Link from "next/link";
import {
  GoalRing,
  HeroPanel,
  LedgerRow,
  MilestoneBadge,
  MiniBars,
  ProgressBar,
  StatTile,
  WeekStrip,
} from "@/components/progress";
import { TEST_ENTRIES } from "@/components/tests/test-catalog";
import { ResumeSlot, TestCard } from "@/components/tests/test-card";
import { clampPct, scaleStep, stepClasses } from "@/lib/progress/scale";
import type { ProgressSummary } from "@/lib/progress/summary";
import { cn } from "@/lib/utils";
import { fmt, plural, toPointBars, toWeekStrip } from "./home-view-model";

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
      className={cn("bg-card flex flex-col gap-3 rounded-2xl border p-4 md:p-5", className)}
    >
      <h2 className="overline-label">{title}</h2>
      {children}
    </section>
  );
}

/** Word test ships in plan 01; until then the CTA is disabled. */
const WORD_TEST_HREF: string | null = null;

function GoalHero({ s, showDetails }: { s: ProgressSummary; showDetails: boolean }) {
  const { today, streak } = s;
  const goalText = `Your daily goal: ${today.goalWords} ${plural(today.goalWords, "word")}${
    today.goalLessons > 0
      ? ` · ${today.goalLessons} grammar ${plural(today.goalLessons, "lesson")}`
      : ""
  }`;
  const cta =
    today.wordsLeft > 0
      ? `Review ${today.wordsLeft} more ${plural(today.wordsLeft, "word")}`
      : "Keep reviewing";
  const ctaClass =
    "bg-on-hero text-hero inline-flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold disabled:opacity-60 md:w-auto md:self-start md:px-6";

  return (
    <HeroPanel aria-label="Daily goal" className="flex flex-col gap-5 md:col-span-2">
      <div className="flex items-center gap-5">
        <GoalRing
          words={{ done: today.words, goal: today.goalWords }}
          lessons={{ done: today.lessons, goal: today.goalLessons }}
          size={112}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-[0.08em] uppercase opacity-75">
            {today.met ? "Today · goal met" : "Today"}
          </span>
          <p className="font-display text-xl leading-snug md:text-2xl">{goalText}</p>
          <p className="text-[13px] opacity-75" data-testid="goal-counts">
            {today.words} / {today.goalWords} words
            {today.goalLessons > 0 && (
              <>
                {" "}
                · {today.lessons} / {today.goalLessons} {plural(today.goalLessons, "lesson")}
              </>
            )}
          </p>
        </div>
      </div>

      {showDetails && (
        <div className="flex flex-col gap-2">
          <WeekStrip days={toWeekStrip(s.week)} tone="hero" />
          <p className="text-[13px] font-semibold" data-testid="streak">
            Streak {streak.current} {plural(streak.current, "day")}
            <span className="font-normal opacity-75">
              {" "}
              · best {streak.best} {plural(streak.best, "day")}
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {WORD_TEST_HREF ? (
          <Link href={WORD_TEST_HREF} className={ctaClass}>
            {cta}
          </Link>
        ) : (
          <>
            <button type="button" disabled className={ctaClass}>
              {cta}
            </button>
            <span className="text-xs opacity-75">Word tests arrive with plan 01</span>
          </>
        )}
      </div>
    </HeroPanel>
  );
}

function RankCard({ s }: { s: ProgressSummary }) {
  const { rank, points } = s;
  return (
    <CardShell title="Rank">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display min-w-0 text-2xl font-medium" data-testid="rank-name">
          {rank.name}
        </span>
        <span className="text-brass-text shrink-0 text-[15px] font-semibold whitespace-nowrap tabular-nums">
          {fmt(points.total)} pts
        </span>
      </div>
      <ProgressBar
        pct={rank.pctToNext}
        tone="brass"
        size="sm"
        label={rank.next ? `Progress to ${rank.next.name}` : "Top rank"}
      />
      <span className="text-muted-foreground text-[13px]">
        {rank.next
          ? `${fmt(rank.next.at - points.total)} pts to ${rank.next.name}`
          : "Top rank reached"}
      </span>
      <div className="flex items-baseline justify-between gap-3 border-t pt-3">
        <span className="text-[13px] font-semibold">This week</span>
        <span className="text-[13px] tabular-nums">
          <span className="text-brass-text font-semibold">+{fmt(points.week)}</span>
          <span className="text-muted-foreground"> · today +{fmt(points.today)}</span>
        </span>
      </div>
      <MiniBars values={toPointBars(s.week, s.today.date)} label="Points this week" height={44} />
    </CardShell>
  );
}

function LedgerCard({ s }: { s: ProgressSummary }) {
  return (
    <CardShell title="Mastery ledger" className="md:col-span-2">
      <div className="divide-y">
        {s.ledger.map((row) =>
          row.count !== undefined ? (
            <div key={row.id} className="flex items-end justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{row.name}</div>
                {row.sub && (
                  <div className="text-muted-foreground truncate text-[13px]">{row.sub}</div>
                )}
              </div>
              <span className="font-display text-2xl leading-none font-medium tabular-nums">
                {fmt(row.count)}
              </span>
            </div>
          ) : (
            <LedgerRow key={row.id} name={row.name} sub={row.sub} pct={row.pct} delta={row.delta} />
          ),
        )}
      </div>
    </CardShell>
  );
}

function MilestoneCard({ s }: { s: ProgressSummary }) {
  const next = s.nextMilestone;
  if (!next) return null;
  return (
    <CardShell title="Next milestone">
      <div className="flex items-center gap-4">
        <MilestoneBadge
          title={next.milestone.label}
          earned={false}
          pct={next.pct}
          className="w-auto"
        />
      </div>
      <span className="text-muted-foreground text-[13px]">{s.milestonesEarned} of 24 earned</span>
    </CardShell>
  );
}

function TestTiles({ s }: { s: ProgressSummary }) {
  if (s.tests.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:col-span-3 md:grid-cols-3">
      {s.tests.map((t) => {
        const entry = TEST_ENTRIES.find((e) => e.id === t.testId);
        const v = t.lastScore === null ? null : clampPct(t.lastScore);
        return (
          <StatTile
            key={t.testId}
            label={entry?.title ?? t.testId}
            value={v === null ? "–" : `${v}%`}
            valueClassName={v === null ? "text-muted-foreground" : stepClasses(scaleStep(v)).text}
            sub={t.sub ?? (v === null ? "Not taken yet" : "Last score")}
          />
        );
      })}
    </div>
  );
}

/** Home dashboard (canvas "Home"): pure render of a ProgressSummary. */
export function HomeDashboard({ summary: s }: { summary: ProgressSummary }) {
  const showProgress = !s.isEmpty;
  return (
    <>
      <div className="grid items-start gap-4 md:grid-cols-3">
        <GoalHero s={s} showDetails={showProgress} />
        {showProgress && s.settings.showPoints && <RankCard s={s} />}
        {showProgress && s.ledger.length > 0 && <LedgerCard s={s} />}
        {showProgress && <MilestoneCard s={s} />}
        {showProgress && <TestTiles s={s} />}
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
    </>
  );
}
