import type { Db } from "@/db/types";
import type { Language } from "@/lib/languages";
import type { MilestoneSnapshot } from "./milestones";

/**
 * Registries filled by later plans (01 words, 03 grammar, 05 TOPIK, 06 coverage).
 * A source that is not registered yet yields `null`: no milestone progress, no ledger row,
 * no test tile — never a fake number.
 *
 * Registration modules are imported from `lib/progress/register-sources.ts`.
 */

export type SourceCtx = { db: Db; userId: string; language: Language; today: string };

type SnapshotKey = Exclude<keyof MilestoneSnapshot, "streak">;
type SnapshotValue<K extends SnapshotKey> = NonNullable<MilestoneSnapshot[K]>;

export type LedgerRowData = {
  id: string;
  name: string;
  sub?: string;
  pct: number | null;
  delta?: number;
  /** Raw count shown instead of a % (e.g. "Due today"). */
  count?: number;
};

export type TestScoreData = {
  /** Test catalog id (components/tests/test-catalog.ts). */
  testId: string;
  /** Last score %, or null when never taken. */
  lastScore: number | null;
  sub?: string;
};

type Fn<T> = (ctx: SourceCtx) => Promise<T | null>;

const snapshotSources = new Map<SnapshotKey, Fn<unknown>>();
const ledgerSources = new Map<string, { order: number; fn: Fn<LedgerRowData> }>();
const testScoreSources = new Map<string, Fn<TestScoreData>>();

export function registerSnapshotSource<K extends SnapshotKey>(
  key: K,
  fn: Fn<SnapshotValue<K>>,
): void {
  snapshotSources.set(key, fn as Fn<unknown>);
}

/** Ledger rows render in ascending `order` (words 10, grammar 20, coverage 30, due 40). */
export function registerLedgerSource(id: string, order: number, fn: Fn<LedgerRowData>): void {
  ledgerSources.set(id, { order, fn });
}

export function registerTestScoreSource(testId: string, fn: Fn<TestScoreData>): void {
  testScoreSources.set(testId, fn);
}

/** Test-only: drop every registration. */
export function resetSources(): void {
  snapshotSources.clear();
  ledgerSources.clear();
  testScoreSources.clear();
}

export async function collectSnapshot(ctx: SourceCtx, streak: number): Promise<MilestoneSnapshot> {
  const snapshot: MilestoneSnapshot = { streak };
  for (const [key, fn] of snapshotSources) {
    (snapshot as Record<string, unknown>)[key] = await fn(ctx);
  }
  return snapshot;
}

export async function collectLedger(ctx: SourceCtx): Promise<LedgerRowData[]> {
  const entries = [...ledgerSources.values()].sort((a, b) => a.order - b.order);
  const rows: LedgerRowData[] = [];
  for (const { fn } of entries) {
    const row = await fn(ctx);
    if (row) rows.push(row);
  }
  return rows;
}

export async function collectTestScores(ctx: SourceCtx): Promise<TestScoreData[]> {
  const rows: TestScoreData[] = [];
  for (const fn of testScoreSources.values()) {
    const row = await fn(ctx);
    if (row) rows.push(row);
  }
  return rows;
}
