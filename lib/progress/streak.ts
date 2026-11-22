import { addDays, diffDays } from "./days";

export type Streak = { current: number; best: number; todayMet: boolean };

/**
 * Streak = consecutive local days with the goal met. Today not (yet) met does not
 * break it; a missed day does. Dates after `today` are ignored.
 */
export function computeStreak(metDates: string[], today: string): Streak {
  const days = [...new Set(metDates)].filter((d) => d <= today).sort();
  const set = new Set(days);
  const todayMet = set.has(today);

  let current = 0;
  let cursor = todayMet ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDays(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current), todayMet };
}
