// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MILESTONES_BY_ID } from "@/lib/progress/milestones";
import { rankFor } from "@/lib/progress/ranks";
import type { ActivityResult } from "@/lib/progress/record";
import { SessionSummary } from "./session-summary";

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  toast.mockClear();
});

function result(over: Partial<ActivityResult> = {}): ActivityResult {
  return {
    pointsAdded: 165,
    goal: { pct: 100, met: true, justMet: true },
    streak: { current: 12, best: 12, todayMet: true },
    newMilestones: [MILESTONES_BY_ID.get("words-50")!],
    rank: rankFor(18_700),
    pointsTotal: 18_700,
    awarded: [
      ...Array.from({ length: 14 }, () => ({
        kind: "word_answer" as const,
        points: 10,
        refId: null,
        meta: {},
      })),
      { kind: "goal_met", points: 25, refId: null, meta: {} },
    ],
    localDate: "2026-11-22",
    ...over,
  };
}

describe("SessionSummary", () => {
  it("renders banner, breakdown, rank progress and toasts milestones", () => {
    render(<SessionSummary result={result()} />);
    expect(screen.getByText("Daily goal met · streak 12 days")).toBeTruthy();
    expect(screen.getByText("Correct answers × 14")).toBeTruthy();
    expect(screen.getByText("+165 pts")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Progress to Upper-intermediate" }),
    ).toBeTruthy();
    expect(screen.getByText("3,300 pts to Upper-intermediate")).toBeTruthy();
    expect(toast).toHaveBeenCalledWith("Milestone reached: 50 words known");
  });

  it("no banner when the goal was not just met; no toast when celebrations are off", () => {
    render(
      <SessionSummary
        result={result({ goal: { pct: 60, met: false, justMet: false } })}
        celebrateMilestones={false}
      />,
    );
    expect(screen.queryByText(/Daily goal met ·/)).toBeNull();
    expect(screen.queryByText(/Milestone reached/)).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it("hides points when show_points is off", () => {
    render(<SessionSummary result={result()} showPoints={false} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
