# Plan 00c — Progress & motivation core (daily goal, streak, points, ranks, milestones)

**Goal:** the data and logic behind the motivation system of `docs/DESIGN.md` §4, a single `recordActivity()` entry point that every later plan calls, the Settings for goals, and a Home page wired to real progress data.

**Depends on:** 00b. Later plans (01, 02, 03, 05, 06) emit activity through this plan's API; each of them lists its events in its "Progress hooks" section.

---

## Data model (`db/schema/progress.ts`)

`user_settings` — add:
- `timezone` text default `'UTC'` (IANA; auto-detected, see T4)
- `show_points` boolean default `true`, `celebrate_milestones` boolean default `true`

`language_profiles` — add:
- `daily_goal_words` smallint default 20 (5–200), `daily_goal_grammar` smallint default 1 (0–5)
- `points_total` int default 0 (cache of the sum of `activity_events.points`)
- `best_streak` int default 0

`activity_events`
- `id` uuid, `user_id`, `language`
- `kind` text: `word_answer | word_known | grammar_credit | grammar_answer | topik_answer | goal_met | milestone`
- `points` int, `ref_id` uuid null (word / lesson / question id), `session_id` uuid null, `meta` jsonb default `{}`
- `local_date` date (day in the user's timezone at insert time)
- `dedupe_key` text null — unique (`user_id`, `dedupe_key`) when not null (e.g. `grammar_credit:<lessonId>:<date>`, `goal_met:<lang>:<date>`, `word_answer:<reviewId>`)
- `created_at`; index (`user_id`, `language`, `local_date`)

`daily_progress` (one row per user/language/day, updated in the same transaction as events)
- PK (`user_id`, `language`, `local_date`)
- `words_answered` int 0, `grammar_lessons` int 0, `points` int 0
- `goal_words`, `goal_grammar` smallint (snapshot of the goal that day)
- `goal_met` bool false, `goal_met_at` timestamptz null

No extra table for the grammar credit: condition (c) (≥ 3 tagged questions in a day) is computed from `question_attempts` by plans 03/05 before they call `recordActivity`.

`milestones_earned` — PK (`user_id`, `language`, `milestone_id`), `earned_at`.

---

## Pure logic (`lib/progress/`, fully unit-tested)
- `points.ts` — `POINTS` table from DESIGN.md §4 and `pointsFor(event)`.
- `goal.ts` — `goalPercent({ words, lessons, goalWords, goalLessons })` (goalLessons 0 → that half counts as met), `isGoalMet(...)`.
- `days.ts` — `localDate(now, timezone)` (Intl, no date library), `addDays`.
- `streak.ts` — `computeStreak(metDates: string[], today: string)` → `{ current, best, todayMet }`; today not met does not break the streak; a gap of one day does.
- `ranks.ts` — `RANKS` (DESIGN.md §4), `rankFor(points)` → `{ name, floor, next?: { name, at }, pctToNext }`.
- `milestones.ts` — catalog of the 24 milestones `{ id, group, threshold, label }` and `evaluate(snapshot)` → `{ earned: id[], progress: Record<id, pct> }` where `snapshot = { wordsKnown, grammarMastered, streak, coverageByLevel?, bestSeriousTopik? }` (missing data → milestone progress `null`, never earned).
- Tests: timezone boundary (23:59 Seoul vs UTC), DST in Europe/Paris, streak across month end, rank boundaries, milestone progress with missing sources.

## Server API (`lib/progress/record.ts`, `server-only`)
```ts
recordActivity(db, { userId, language, events: ActivityInput[], now? }): Promise<ActivityResult>
// ActivityInput = { kind, ref_id?, session_id?, meta?, dedupe_key?, points? /* default from POINTS */ }
// ActivityResult = { pointsAdded, goal: { pct, met, justMet }, streak, newMilestones: Milestone[], rank }
```
One transaction: insert events (skip duplicates by `dedupe_key`) → upsert `daily_progress` (`word_answer` increments `words_answered`; `grammar_credit` increments `grammar_lessons`) → update `points_total` → if the goal becomes met: insert `goal_met` (+25) and set `goal_met_at` → recompute streak (`best_streak`) → evaluate milestones (snapshot via callbacks registered by later plans: `registerSnapshotSource('wordsKnown', fn)`; sources not registered yet are `null`) → insert newly earned `milestones_earned` + `milestone` events (0 points).
`adjustActivity(db, { userId, dedupe_key, points })` for "I was right" overrides / undo (updates the event and the caches).
`getProgressSummary(db, userId, language, now)` → everything Home needs: today (counts, goal, pct), week strip (7 days met/partial), streak, points today/week, weekly points per day, rank, next milestone, ledger rows from registered sources.

## Tasks

### [x] T1 — Schema + migration
Columns and tables above; drizzle migration; PGlite test helper unchanged.

### [x] T2 — Pure logic
Files and tests listed above (≥ 95 % line coverage).

### [ ] T3 — recordActivity / summary
Implementation + PGlite tests: idempotency (same `dedupe_key` twice → counted once), goal met exactly once per day (+25 once), streak updates, `adjustActivity`, milestone earned once, summary for an empty user (all zeros, no crash).

### [ ] T4 — Settings: goals, motivation, timezone
- Settings → **Daily goal** (per active language): steppers "Words to review" (5–200, step 5) and "Grammar lessons" (0–5), 44 px buttons, as in the canvas.
- Settings → **Motivation**: checkboxes "Points & rank", "Milestone celebrations".
- Timezone: a tiny client component posts `Intl.DateTimeFormat().resolvedOptions().timeZone` once when it differs from the stored value (server action, zod-validated against `Intl.supportedValuesOf('timeZone')`); also shown read-only in Settings.

### [ ] T5 — Home wired to data (canvas "Home")
- `HeroPanel` with `GoalRing` (words outer, grammar inner, total %), counts, `WeekStrip`, streak label, CTA "Review N more words" (link to `/tests/words` once plan 01 ships; disabled before).
- Rank card: rank name, points to next rank, week points + `MiniBars` (7 days, today in brass). Hidden when `show_points` is off.
- **Mastery ledger**: `LedgerRow`s from registered sources — Words known (plan 01), Grammar mastered (plan 03), TOPIK N coverage (plan 06), Due today (plan 01). A source not registered yet renders nothing (no fake numbers).
- Test tiles row (plans 01/03/05 register `lastScore` sources) and next milestone card.
- Desktop: same blocks in the canvas grid (hero spans 2 columns), sidebar footer shows rank + bar.
- Empty state for a brand-new user: hero at 0 % with the goal text, everything else hidden.

### [ ] T6 — Shared results blocks
`components/progress/session-summary.tsx`: given an `ActivityResult` (+ session-specific props) renders `GoalMetBanner` (when `justMet`), `PointsBreakdown` (grouped lines from the session's events), rank progress (today's gain in brass) and fires a sonner toast per new milestone (when `celebrate_milestones`). Used by word, grammar and TOPIK results pages.

### [ ] T7 — Dev seed + e2e
- `pnpm db:seed` adds 30 days of activity for the dev user (streak 12, some missed days, points ≈ 18,700 → "Intermediate II").
- e2e: Home shows the seeded goal %, streak and rank; change the words goal in Settings → Home % updates.

## Definition of Done
`recordActivity` is the single way to award progress; Home shows real goal %, week strip, streak, rank and only the ledger rows whose data exists; goals and motivation toggles editable; timezone-correct days; lint/typecheck/test/build/e2e green.
