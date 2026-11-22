import type { WeekDay } from "@/components/progress";

/**
 * Static "nothing yet" data for the Home skeleton (plan 00b).
 * Plan 00c replaces this with real goal / streak / points data.
 */
export type HomeData = {
  goal: { words: { done: number; goal: number }; lessons: { done: number; goal: number } };
  streak: number;
  rank: { name: string; points: number; nextName: string; nextAt: number; availableAfter: string };
  ledger: { name: string; sub: string; pct: number | null }[];
  week: WeekDay[];
};

const DAYS = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
] as const;

export function emptyHomeData(today = new Date()): HomeData {
  const todayIndex = (today.getDay() + 6) % 7; // Monday = 0
  return {
    goal: { words: { done: 0, goal: 20 }, lessons: { done: 0, goal: 1 } },
    streak: 0,
    rank: {
      name: "Novice",
      points: 0,
      nextName: "Beginner I",
      nextAt: 1000,
      availableAfter: "01",
    },
    ledger: [
      { name: "Words known", sub: "Available after plan 01", pct: null },
      { name: "Grammar mastered", sub: "Available after plan 02", pct: null },
      { name: "TOPIK reading", sub: "Available after plan 05", pct: null },
    ],
    week: DAYS.map(([label, name], i) => ({
      label,
      name,
      status: i === todayIndex ? "today" : i < todayIndex ? "missed" : "future",
      pct: i === todayIndex ? 0 : undefined,
    })),
  };
}
