import { and, eq, gte, inArray, sum } from "drizzle-orm";
import { aiUsage } from "@/db/schema";
import type { Db } from "@/db/types";
import { localDate } from "@/lib/progress/days";
import { BudgetError } from "./errors";

/** One user action (may contain several AI calls) sharing the per-request cap. */
export type Operation = {
  id: string;
  userId: string;
  label: string;
  spentEstimate: number;
  spentActual: number;
};

export type BudgetCaps = { budgetPerRequestUsd: number; budgetMonthlyUsd: number };

export function createOperation(userId: string, label: string): Operation {
  return { id: crypto.randomUUID(), userId, label, spentEstimate: 0, spentActual: 0 };
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Real spend (ai_usage.cost_usd) of the user in the current UTC calendar month. */
export async function monthSpent(db: Db, userId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiUsage.costUsd) })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, startOfUtcMonth(now))));
  return Number(row?.total ?? 0);
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

/**
 * Throws BudgetError when the next call (upper-bound `estimate`) could push the
 * operation over the per-request cap or the month over the monthly cap.
 */
export async function assertBudget(
  db: Db,
  op: Operation,
  estimate: number,
  caps: BudgetCaps,
  now = new Date(),
): Promise<void> {
  const opSpent = Math.max(op.spentActual, 0);
  if (opSpent + estimate > caps.budgetPerRequestUsd) {
    throw new BudgetError(
      `This action could cost up to ${usd(opSpent + estimate)}, above your per-request budget of ${usd(caps.budgetPerRequestUsd)}. Raise it in Settings to continue.`,
    );
  }
  const month = await monthSpent(db, op.userId, now);
  if (month + estimate > caps.budgetMonthlyUsd) {
    throw new BudgetError(
      `Monthly AI budget reached: ${usd(month)} spent of ${usd(caps.budgetMonthlyUsd)} (this call could cost up to ${usd(estimate)}). Raise it in Settings to continue.`,
    );
  }
}

// ---- plan providers (claude-code): a daily call cap instead of dollar budgets ----

export type CallCap = { aiCallsDailyCap: number; timezone: string };

/** How many of `dates` fall on the same local day as `now` in `timeZone`. */
export function countOnLocalDay(dates: Date[], now: Date, timeZone: string): number {
  const today = localDate(now, timeZone);
  return dates.filter((d) => localDate(d, timeZone) === today).length;
}

/** Calls made today (user's local day) with `provider`; blocked calls do not count. */
export async function callsToday(
  db: Db,
  userId: string,
  provider: string,
  timeZone: string,
  now = new Date(),
): Promise<number> {
  // A local day is at most 26 h long; 48 h back covers every timezone.
  const since = new Date(now.getTime() - 48 * 3_600_000);
  const rows = await db
    .select({ createdAt: aiUsage.createdAt })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.provider, provider),
        inArray(aiUsage.status, ["ok", "error"]),
        gte(aiUsage.createdAt, since),
      ),
    );
  return countOnLocalDay(
    rows.map((r) => r.createdAt),
    now,
    timeZone,
  );
}

/** Throws BudgetError when the daily call cap of a plan provider is reached. */
export async function assertCallCap(
  db: Db,
  userId: string,
  provider: string,
  cap: CallCap,
  now = new Date(),
): Promise<void> {
  const used = await callsToday(db, userId, provider, cap.timezone, now);
  if (used >= cap.aiCallsDailyCap) {
    throw new BudgetError(
      `Daily AI call limit reached (${used} of ${cap.aiCallsDailyCap} today). Raise it in Settings → AI, or try again tomorrow.`,
    );
  }
}
