import { and, eq, gte, sum } from "drizzle-orm";
import { aiUsage } from "@/db/schema";
import type { Db } from "@/db/types";
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
