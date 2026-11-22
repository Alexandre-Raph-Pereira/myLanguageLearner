import "server-only";
import { and, eq, sql } from "drizzle-orm";
import {
  activityEvents,
  dailyProgress,
  languageProfiles,
  milestonesEarned,
  type ActivityKind,
} from "@/db/schema";
import type { Db } from "@/db/types";
import { LANGUAGE_EXAMS, type Language } from "@/lib/languages";
import { getUserSettings } from "@/lib/settings";
import { localDate } from "./days";
import { goalPercent, isGoalMet } from "./goal";
import { evaluate, MILESTONES_BY_ID, type Milestone } from "./milestones";
import { pointsFor, POINTS, type PointsMeta } from "./points";
import { rankFor, type Rank } from "./ranks";
import { collectSnapshot } from "./sources";
import { computeStreak, type Streak } from "./streak";
import "./register-sources";

export type ActivityInput = {
  kind: ActivityKind;
  ref_id?: string | null;
  session_id?: string | null;
  meta?: PointsMeta & Record<string, unknown>;
  dedupe_key?: string | null;
  /** Defaults to `pointsFor({ kind, meta })`. */
  points?: number;
};

export type AwardedEvent = {
  kind: ActivityKind;
  points: number;
  refId: string | null;
  meta: Record<string, unknown>;
};

export type ActivityResult = {
  /** Total points added by this call, including the daily-goal bonus. */
  pointsAdded: number;
  goal: { pct: number; met: boolean; justMet: boolean };
  streak: Streak;
  newMilestones: Milestone[];
  rank: Rank;
  /** Events actually inserted (duplicates skipped), incl. goal_met / milestone. */
  awarded: AwardedEvent[];
  localDate: string;
};

/** Transaction handle; same query API as Db. */
type Tx = Db;

async function ensureProfile(tx: Tx, userId: string, language: Language) {
  await tx
    .insert(languageProfiles)
    .values({ userId, language, exam: LANGUAGE_EXAMS[language] ?? "TOPIK" })
    .onConflictDoNothing();
  const [profile] = await tx
    .select()
    .from(languageProfiles)
    .where(and(eq(languageProfiles.userId, userId), eq(languageProfiles.language, language)));
  return profile;
}

async function insertEvents(
  tx: Tx,
  rows: (typeof activityEvents.$inferInsert)[],
): Promise<AwardedEvent[]> {
  if (rows.length === 0) return [];
  // The only unique constraint besides the random PK is (user_id, dedupe_key): duplicates are skipped.
  const inserted = await tx.insert(activityEvents).values(rows).onConflictDoNothing().returning({
    kind: activityEvents.kind,
    points: activityEvents.points,
    refId: activityEvents.refId,
    meta: activityEvents.meta,
  });
  return inserted;
}

/**
 * The single entry point that awards progress (points, goal, streak, milestones).
 * Everything happens in one transaction; replaying the same `dedupe_key` is a no-op.
 */
export async function recordActivity(
  db: Db,
  input: { userId: string; language: Language; events: ActivityInput[]; now?: Date },
): Promise<ActivityResult> {
  const { userId, language } = input;
  const now = input.now ?? new Date();
  const settings = await getUserSettings(db, userId);
  const today = localDate(now, settings.timezone);

  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as Tx;
    const profile = await ensureProfile(tx, userId, language);

    const base = { userId, language, localDate: today, createdAt: now };
    const awarded = await insertEvents(
      tx,
      input.events.map((e) => ({
        ...base,
        kind: e.kind,
        points: e.points ?? pointsFor({ kind: e.kind, meta: e.meta }),
        refId: e.ref_id ?? null,
        sessionId: e.session_id ?? null,
        meta: e.meta ?? {},
        dedupeKey: e.dedupe_key ?? null,
      })),
    );

    const words = awarded.filter((e) => e.kind === "word_answer").length;
    const lessons = awarded.filter((e) => e.kind === "grammar_credit").length;
    let points = awarded.reduce((a, e) => a + e.points, 0);

    // Today's goal snapshot follows the current goal (Settings changes apply immediately).
    const [day] = await tx
      .insert(dailyProgress)
      .values({
        userId,
        language,
        localDate: today,
        wordsAnswered: words,
        grammarLessons: lessons,
        points,
        goalWords: profile.dailyGoalWords,
        goalGrammar: profile.dailyGoalGrammar,
      })
      .onConflictDoUpdate({
        target: [dailyProgress.userId, dailyProgress.language, dailyProgress.localDate],
        set: {
          wordsAnswered: sql`${dailyProgress.wordsAnswered} + ${words}`,
          grammarLessons: sql`${dailyProgress.grammarLessons} + ${lessons}`,
          points: sql`${dailyProgress.points} + ${points}`,
          goalWords: profile.dailyGoalWords,
          goalGrammar: profile.dailyGoalGrammar,
        },
      })
      .returning();

    const counts = {
      words: day.wordsAnswered,
      lessons: day.grammarLessons,
      goalWords: day.goalWords,
      goalLessons: day.goalGrammar,
    };
    let justMet = false;
    if (!day.goalMet && isGoalMet(counts)) {
      const bonus = await insertEvents(tx, [
        {
          ...base,
          kind: "goal_met",
          points: POINTS.goalMet,
          dedupeKey: `goal_met:${language}:${today}`,
        },
      ]);
      if (bonus.length > 0) {
        justMet = true;
        awarded.push(...bonus);
        points += POINTS.goalMet;
        await tx
          .update(dailyProgress)
          .set({
            goalMet: true,
            goalMetAt: now,
            points: sql`${dailyProgress.points} + ${POINTS.goalMet}`,
          })
          .where(
            and(
              eq(dailyProgress.userId, userId),
              eq(dailyProgress.language, language),
              eq(dailyProgress.localDate, today),
            ),
          );
      }
    }

    const metRows = await tx
      .select({ d: dailyProgress.localDate })
      .from(dailyProgress)
      .where(
        and(
          eq(dailyProgress.userId, userId),
          eq(dailyProgress.language, language),
          eq(dailyProgress.goalMet, true),
        ),
      );
    const computed = computeStreak(
      metRows.map((r) => r.d),
      today,
    );
    const streak = { ...computed, best: Math.max(computed.best, profile.bestStreak) };

    // Milestones
    const snapshot = await collectSnapshot({ db: tx, userId, language, today }, streak.current);
    const evaluation = evaluate(snapshot);
    const newMilestones: Milestone[] = [];
    if (evaluation.earned.length > 0) {
      const earned = await tx
        .insert(milestonesEarned)
        .values(
          evaluation.earned.map((milestoneId) => ({
            userId,
            language,
            milestoneId,
            earnedAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: milestonesEarned.milestoneId });
      for (const { id } of earned) {
        const m = MILESTONES_BY_ID.get(id);
        if (m) newMilestones.push(m);
      }
      awarded.push(
        ...(await insertEvents(
          tx,
          newMilestones.map((m) => ({
            ...base,
            kind: "milestone" as const,
            points: POINTS.milestone,
            meta: { milestoneId: m.id },
            dedupeKey: `milestone:${language}:${m.id}`,
          })),
        )),
      );
    }

    const [updated] = await tx
      .update(languageProfiles)
      .set({
        pointsTotal: sql`${languageProfiles.pointsTotal} + ${points}`,
        bestStreak: streak.best,
        updatedAt: now,
      })
      .where(and(eq(languageProfiles.userId, userId), eq(languageProfiles.language, language)))
      .returning({ pointsTotal: languageProfiles.pointsTotal });

    return {
      pointsAdded: points,
      goal: { pct: goalPercent(counts), met: day.goalMet || justMet, justMet },
      streak,
      newMilestones,
      rank: rankFor(updated.pointsTotal),
      awarded,
      localDate: today,
    };
  });
}

/**
 * Changes the points of one event (e.g. "I was right" override or its undo) and the caches.
 * Returns null when no event has that dedupe key.
 */
export async function adjustActivity(
  db: Db,
  input: { userId: string; dedupe_key: string; points: number; meta?: Record<string, unknown> },
): Promise<{ delta: number; rank: Rank } | null> {
  return db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as Tx;
    const [event] = await tx
      .select()
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.userId, input.userId),
          eq(activityEvents.dedupeKey, input.dedupe_key),
        ),
      );
    if (!event) return null;
    const delta = input.points - event.points;
    await tx
      .update(activityEvents)
      .set({ points: input.points, meta: { ...event.meta, ...input.meta } })
      .where(eq(activityEvents.id, event.id));
    if (delta !== 0) {
      await tx
        .update(dailyProgress)
        .set({ points: sql`${dailyProgress.points} + ${delta}` })
        .where(
          and(
            eq(dailyProgress.userId, input.userId),
            eq(dailyProgress.language, event.language),
            eq(dailyProgress.localDate, event.localDate),
          ),
        );
    }
    const [profile] = await tx
      .update(languageProfiles)
      .set({ pointsTotal: sql`${languageProfiles.pointsTotal} + ${delta}` })
      .where(
        and(
          eq(languageProfiles.userId, input.userId),
          eq(languageProfiles.language, event.language),
        ),
      )
      .returning({ pointsTotal: languageProfiles.pointsTotal });
    return { delta, rank: rankFor(profile?.pointsTotal ?? 0) };
  });
}
