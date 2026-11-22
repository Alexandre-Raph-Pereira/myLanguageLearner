// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
} from ".";

afterEach(cleanup);

describe("rings", () => {
  it("GoalRing announces the total and both goals", () => {
    render(<GoalRing words={{ done: 14, goal: 20 }} lessons={{ done: 1, goal: 1 }} />);
    expect(
      screen.getByRole("img", { name: "Daily goal 85%: 14 of 20 words, 1 of 1 lesson" }),
    ).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("GoalRing at 0 % for the empty state", () => {
    render(<GoalRing words={{ done: 0, goal: 20 }} lessons={{ done: 0, goal: 1 }} />);
    expect(screen.getByRole("img", { name: /^Daily goal 0%/ })).toBeInTheDocument();
  });

  it("ProgressRing labels its value and shows a dash when muted", () => {
    const { rerender } = render(<ProgressRing pct={72} label="Score" sub="18 / 25" />);
    expect(screen.getByRole("img", { name: "Score 72%, 18 / 25" })).toBeInTheDocument();
    rerender(<ProgressRing pct={0} step="muted" label="Mastery" />);
    expect(screen.getByText("–")).toBeInTheDocument();
  });
});

describe("bars", () => {
  it.each([
    [10, "bg-level-0"],
    [45, "bg-level-1"],
    [65, "bg-level-2"],
    [90, "bg-level-3"],
  ])("ProgressBar %s%% uses %s", (pct, cls) => {
    render(<ProgressBar pct={pct} label="Known words" />);
    const bar = screen.getByRole("progressbar", { name: "Known words" });
    expect(bar).toHaveAttribute("aria-valuenow", String(pct));
    expect(bar.firstElementChild).toHaveClass(cls);
  });

  it("ProgressBar tone override", () => {
    render(<ProgressBar pct={10} tone="brass" />);
    expect(screen.getByRole("progressbar").firstElementChild).toHaveClass("bg-brass");
  });

  it("LevelBar shows counts per level", () => {
    render(<LevelBar counts={[12, 30, 50, 8]} />);
    expect(
      screen.getByRole("img", {
        name: "Words by level: level 0 12, level 1 30, level 2 50, level 3 8",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Known").nextSibling).toHaveTextContent("50");
  });

  it("MiniBars colours each bar by the scale", () => {
    render(<MiniBars values={[{ pct: 30 }, { pct: 85 }]} />);
    const chart = screen.getByRole("img", { name: "Score history: 30%, 85%" });
    const bars = chart.querySelectorAll("span");
    expect(bars[0]).toHaveClass("bg-level-0");
    expect(bars[1]).toHaveClass("bg-level-3");
  });

  it("MiniBars keeps at most 12 bars", () => {
    const { container } = render(
      <MiniBars values={Array.from({ length: 20 }, (_, i) => ({ pct: i * 5 }))} />,
    );
    expect(container.querySelectorAll("span")).toHaveLength(12);
  });
});

describe("levels", () => {
  it("LevelBadge shows Lv n on the level fill", () => {
    render(<LevelBadge level={2} showLabel />);
    const badge = screen.getByLabelText("Level 2 (Known)");
    expect(badge).toHaveTextContent("Lv 2 · Known");
    expect(badge).toHaveClass("bg-level-2", "text-on-level-2");
  });

  it("LevelTransition announces the change", () => {
    render(<LevelTransition from={1} to={2} />);
    expect(screen.getByRole("img", { name: "Level 1 to 2" })).toBeInTheDocument();
  });

  it("LevelPips fills up to the level", () => {
    render(<LevelPips level={2} />);
    const pips = screen.getByRole("img", { name: "Level 2 of 3" });
    const bars = pips.firstElementChild!.children;
    expect(bars[0]).toHaveClass("bg-level-2");
    expect(bars[1]).toHaveClass("bg-level-2");
    expect(bars[2]).toHaveClass("bg-track");
    expect(pips).toHaveTextContent("Lv 2");
  });
});

describe("ledger & tiles", () => {
  it("LedgerRow shows the % in the scale text colour and the delta", () => {
    render(<LedgerRow name="Reading" sub="TOPIK II" pct={64} delta={4} />);
    const pct = screen.getByText("64%");
    expect(pct).toHaveClass("text-level-2-text");
    expect(screen.getByText(/4/, { selector: "span.tabular-nums" })).toHaveTextContent("▲ 4");
    expect(screen.getByRole("progressbar", { name: "Reading" })).toBeInTheDocument();
  });

  it("LedgerRow without data is muted", () => {
    render(<LedgerRow name="Grammar" pct={null} />);
    expect(screen.getByText("–")).toHaveClass("text-muted-foreground");
  });

  it("StatTile", () => {
    render(<StatTile label="Streak" value="12" sub="best 30" />);
    expect(screen.getByText("Streak")).toHaveClass("overline-label");
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("PointsBreakdown totals lines", () => {
    render(
      <PointsBreakdown
        lines={[
          { label: "18 correct answers", points: 180 },
          { label: "Daily goal met", points: 25 },
        ]}
      />,
    );
    expect(screen.getByText("+205 pts")).toHaveClass("text-brass-text");
  });
});

describe("week, milestones, banners", () => {
  it("WeekStrip labels every day", () => {
    render(
      <WeekStrip
        days={[
          { label: "M", name: "Monday", status: "met" },
          { label: "T", name: "Tuesday", status: "missed" },
          { label: "W", name: "Wednesday", status: "today", pct: 40 },
          { label: "T", name: "Thursday", status: "future" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "This week" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("Monday: goal met")).toBeInTheDocument();
    expect(screen.getByLabelText("Wednesday: today, 40%")).toBeInTheDocument();
  });

  it("MilestoneBadge earned vs locked", () => {
    render(
      <>
        <MilestoneBadge title="50 words" earned />
        <MilestoneBadge title="100 words" earned={false} pct={62} />
      </>,
    );
    expect(screen.getByRole("img", { name: "50 words: earned" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "100 words: locked, 62%" })).toHaveTextContent("62%");
  });

  it("GoalMetBanner", () => {
    render(<GoalMetBanner streak={6} />);
    expect(screen.getByRole("status")).toHaveTextContent("Daily goal met · streak 6 days");
  });

  it("HeroPanel uses the inverted tokens", () => {
    render(<HeroPanel aria-label="Today">x</HeroPanel>);
    expect(screen.getByRole("region", { name: "Today" })).toHaveClass("bg-hero", "text-on-hero");
  });
});

describe("FeedbackPanel", () => {
  it("correct answer with level change and Korean example", () => {
    render(
      <FeedbackPanel
        correct
        expected="사과"
        language="ko"
        levelFrom={1}
        levelTo={2}
        nextReview="in 3 days"
        example={{ text: "사과를 먹어요.", translation: "I eat an apple." }}
      />,
    );
    const panel = screen.getByRole("status");
    expect(panel).toHaveClass("bg-good-soft");
    expect(panel).toHaveTextContent("Correct");
    expect(screen.getByText("사과")).toHaveAttribute("lang", "ko");
    expect(screen.getByRole("img", { name: "Level 1 to 2" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Next review in 3 days");
  });

  it("wrong answer", () => {
    render(<FeedbackPanel correct={false} expected="사과" levelFrom={2} levelTo={0} />);
    const panel = screen.getByRole("status");
    expect(panel).toHaveClass("bg-wrong-soft");
    expect(panel).toHaveTextContent("Not quite");
  });
});
