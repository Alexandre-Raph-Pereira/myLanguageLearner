// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MILESTONES_BY_ID } from "@/lib/progress/milestones";
import { rankFor } from "@/lib/progress/ranks";
import type { ProgressSummary } from "@/lib/progress/summary";
import { HomeDashboard } from "./home-dashboard";
import { toPointBars, toWeekStrip } from "./home-view-model";

afterEach(cleanup);

const week = (statuses: ProgressSummary["week"][number]["status"][]) =>
  statuses.map((status, i) => ({
    date: `2026-11-${String(16 + i).padStart(2, "0")}`,
    status,
    pct: status === "met" ? 100 : status === "today" ? 85 : 0,
    points: status === "future" ? 0 : 100 + i * 10,
  }));

function summary(over: Partial<ProgressSummary> = {}): ProgressSummary {
  return {
    today: {
      date: "2026-11-22",
      words: 14,
      lessons: 1,
      goalWords: 20,
      goalLessons: 1,
      pct: 85,
      met: false,
      wordsLeft: 6,
    },
    week: week(["met", "met", "missed", "met", "met", "met", "today"]),
    streak: { current: 3, best: 12, todayMet: false },
    points: { total: 18_700, today: 160, week: 910 },
    rank: rankFor(18_700),
    nextMilestone: { milestone: MILESTONES_BY_ID.get("streak-7")!, pct: 43 },
    milestonesEarned: 2,
    ledger: [],
    tests: [],
    settings: { showPoints: true, celebrateMilestones: true, timezone: "UTC" },
    isEmpty: false,
    ...over,
  };
}

describe("HomeDashboard", () => {
  it("shows goal %, streak, rank and next milestone", () => {
    render(<HomeDashboard summary={summary()} />);
    expect(screen.getByRole("img", { name: /^Daily goal 85%: 14 of 20 words/ })).toBeTruthy();
    expect(screen.getByTestId("streak").textContent).toContain("Streak 3 days");
    expect(screen.getByTestId("rank-name").textContent).toBe("Intermediate II");
    expect(screen.getByText("3,300 pts to Upper-intermediate")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review 6 more words" }).getAttribute("href")).toBe(
      "/tests/words",
    );
    expect(screen.getByRole("img", { name: /^7-day streak: locked, 43%/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Mastery ledger" })).toBeNull();
  });

  it("hides points when show_points is off", () => {
    render(
      <HomeDashboard
        summary={summary({
          settings: { showPoints: false, celebrateMilestones: true, timezone: "UTC" },
        })}
      />,
    );
    expect(screen.queryByRole("region", { name: "Rank" })).toBeNull();
  });

  it("renders only registered ledger rows and test tiles", () => {
    render(
      <HomeDashboard
        summary={summary({
          ledger: [
            { id: "words", name: "Words known", sub: "312 of 1,200", pct: 26 },
            { id: "due", name: "Due today", pct: null, count: 41 },
          ],
          tests: [{ testId: "words", lastScore: 82 }],
        })}
      />,
    );
    expect(screen.getByRole("region", { name: "Mastery ledger" })).toBeTruthy();
    expect(screen.getByText("Words known")).toBeTruthy();
    expect(screen.getByText("41")).toBeTruthy();
    expect(screen.getByText("82%")).toBeTruthy();
  });

  it("empty state: hero at 0 % with the goal text, everything else hidden", () => {
    render(
      <HomeDashboard
        summary={summary({
          isEmpty: true,
          today: {
            date: "2026-11-22",
            words: 0,
            lessons: 0,
            goalWords: 20,
            goalLessons: 1,
            pct: 0,
            met: false,
            wordsLeft: 20,
          },
        })}
      />,
    );
    expect(screen.getByRole("img", { name: /^Daily goal 0%/ })).toBeTruthy();
    expect(screen.getByText("Your daily goal: 20 words · 1 grammar lesson")).toBeTruthy();
    expect(screen.queryByTestId("streak")).toBeNull();
    expect(screen.queryByRole("region", { name: "Rank" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Next milestone" })).toBeNull();
  });
});

describe("home view model", () => {
  it("maps week days to labels and today", () => {
    const strip = toWeekStrip(
      week(["met", "missed", "missed", "missed", "missed", "missed", "today"]),
    );
    expect(strip[0]).toEqual({ label: "M", name: "Monday", status: "met", pct: undefined });
    expect(strip[6]).toEqual({ label: "S", name: "Sunday", status: "today", pct: 85 });
  });

  it("scales point bars and highlights today", () => {
    const bars = toPointBars(
      week(["met", "met", "met", "met", "met", "met", "today"]),
      "2026-11-22",
    );
    expect(bars[6]).toMatchObject({ tone: "brass", pct: 100, text: "160 pts" });
    expect(bars[0].tone).toBe("track");
    expect(bars[0].pct).toBeCloseTo(62.5);
  });
});
