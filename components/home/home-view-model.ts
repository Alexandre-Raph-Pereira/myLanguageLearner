import type { MiniBar, WeekDay } from "@/components/progress";
import { weekdayIndex } from "@/lib/progress/days";
import type { SummaryDay } from "@/lib/progress/summary";

const DAYS = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
] as const;

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** Summary days → WeekStrip segments (today met shows as met). */
export function toWeekStrip(days: SummaryDay[]): WeekDay[] {
  return days.map((d) => {
    const [label, name] = DAYS[weekdayIndex(d.date)];
    return { label, name, status: d.status, pct: d.status === "today" ? d.pct : undefined };
  });
}

/** Points per day → MiniBars (scaled to the week's best day, today in brass). */
export function toPointBars(days: SummaryDay[], today: string): MiniBar[] {
  const max = Math.max(...days.map((d) => d.points), 1);
  return days.map((d) => {
    const [label] = DAYS[weekdayIndex(d.date)];
    return {
      label,
      pct: (d.points / max) * 100,
      tone: d.date === today ? "brass" : "track",
      text: `${fmt(d.points)} pts`,
    };
  });
}
