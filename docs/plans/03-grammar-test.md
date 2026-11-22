# Plan 03 — Grammar test + shared test engine

**Goal:** generate tests on chosen grammar lessons to check understanding, and build the **shared test engine** (question bank, attempts, retry pool, chunked generation, verification) that the TOPIK plans reuse.

**Depends on:** 01 (`test_sessions`), 02 (grammar lessons).

---

## Data model (`db/schema/tests.ts`)

`questions` (question bank, shared with TOPIK)
- `id` uuid, `user_id`, `language`
- `source` text `grammar | topik`
- `question_type` text — e.g. `grammar.mcq_blank`, `topik2.grammar_blank`
- `level` smallint null
- `passage_id` uuid null (FK added in plan 04)
- `payload` jsonb — validated by the zod schema of its `question_type` (discriminated union in `lib/tests/question-types.ts`)
- `explanation_md` text
- `grammar_ids` uuid[] default `{}`, GIN index
- `verification` text `unverified | passed | failed`
- `retry_state` text `none | pending | cleared` default `none`
- `times_served` int 0, `created_at`

`session_items` (ordered content of a session)
- `id`, `session_id` → test_sessions (cascade), `position` int, `question_id` → questions, `group_key` text null (chunk/passage group), `from_retry` bool
- unique (`session_id`, `position`)

`question_attempts`
- `id`, `user_id`, `question_id`, `session_id`, `response` jsonb, `correct` bool, `ai_feedback_md` text null, `time_ms` int null, `created_at`

`test_sessions.config` for grammar: `{ grammarIds, types, count }`; add column `generation` jsonb `{ totalGroups, readyGroups, failedGroups }`.

---

## Shared engine (`lib/tests/`)

- `question-types.ts` — registry: `{ type, payloadSchema, grade(payload, response) => { correct, needsAi? } }`. Plans 03/04 register their types.
- `retry.ts`
  - `markResult(question, correct)`: wrong → `retry_state = 'pending'`; correct while `pending` → `'cleared'`.
  - `pickRetryQuestions({ userId, source, filter, max })`: pending questions matching filter (types, grammar ids overlap, exam/level), oldest attempt first. `max = floor(0.3 × requested count)`.
  - A question with `retry_state` `none` and ≥ 1 attempt, or `cleared`, is **never served again**.
- `generation.ts` — chunked generation pattern:
  1. `createSession()` inserts the session (`status = generating`), inserts retry items immediately (positions first), computes a **generation plan** (list of groups, each = a few questions) stored in `config.plan`.
  2. Client calls `POST /api/tests/[sessionId]/generate/[groupIndex]` for every group, concurrency 3 (helper hook `useSessionGeneration`). Each call is idempotent (skips if group already generated), runs generate → verify → (plan 04: annotate), inserts questions + session_items, updates `generation`.
  3. Session becomes `ready` when all groups are ready or failed; the runner may start as soon as the first items exist and shows "preparing next questions…" if the user catches up.
  4. All AI calls of one session share **one budget operation** (`operation_id` stored in `config`), so the per-request cap covers the whole test.
- `verify.ts` — `verifyMcq({ question, context })`: fast-tier solver gets stem/passage + options **without the answer**, returns `{ answerIndex, confidence }`. Mismatch → regenerate that group once; second mismatch → drop the question and log it.
- `ProgressHeader`, `QuestionShell`, `FeedbackPanel`, `ResultsSummary` components, reused in plan 05.

---

## Grammar question types (`lib/tests/types/grammar.ts`)

| type | payload | grading |
|---|---|---|
| `grammar.mcq_blank` | `{ sentence_with_blank, translation_en, options[4], answerIndex, target_grammar_id }` | deterministic |
| `grammar.conjugate` | `{ prompt_ko /* sentence with [먹다 + -(으)ㄹ 수 있다] */, translation_en, accepted: string[] }` | `normKo` match against accepted |
| `grammar.choose_correct` | `{ instruction: 'correct'|'incorrect', sentences[4], answerIndex }` | deterministic |
| `grammar.translate` | `{ en_sentence, target_grammar_id, reference_ko }` | AI-graded (fast tier, task `grammar.grade_translation`): `{ correct, feedback_md, corrected_ko }` |

All payloads carry `explanation_md` (stored on the question) explaining why the answer is right and why each distractor is wrong (short).

## AI tasks (`lib/ai/prompts/grammar-test.ts`)

### `grammar.test_generate` (smart, `cacheSystem: true`)
Input: full content of the selected lessons; compact list of all other lessons (distractor pool); target level; up to 150 known words (level ≥ 2, random sample) as preferred vocabulary; requested types and count for this group (≤ 5 questions per group).
Rules: one unambiguous correct answer; distractors = plausible confusions (similar grammar from the "similar" section, wrong conjugation, wrong tense); natural Korean; vocabulary at or below target level, prefer the known words; vary contexts; never reuse an example sentence from the lesson verbatim; tag each question with the grammar it tests.
Output: `{ questions: [...] }` (discriminated union).

### `grammar.test_verify` → `verifyMcq` (fast). For `conjugate`, solver must produce a form contained in `accepted` (else drop).
### `grammar.grade_translation` (fast)
Rules: judge only grammar use + meaning, tolerate small spelling slips (mention them), require the target grammar to be used, feedback ≤ 3 sentences in English.

---

## Design & progress hooks
Runner and results reuse the word-test look (DESIGN.md §2: `FeedbackPanel`, brass progress bar, `session-summary`). Tests hub card "Grammar test" shows last-30-days % + `MiniBars`.
- Events: correct `mcq_blank` / `conjugate` / `choose_correct` → `grammar_answer` +10; `translate` judged correct → +15 (`dedupe_key` = `grammar_answer:<attemptId>`). After each answer, if ≥ 3 questions tagged with a lesson were answered today → `grammar_credit` for that lesson (same dedupe key as plan 02, so it counts once).
- Snapshot sources: `grammarMastered` (count mastered), ledger row "Grammar mastered" (`mastered / lessons`), test tile `lastScore.grammar`.
- Mastery colours: `not_tested` muted, `learning` = `scaleStep(pct)`, `mastered` = level-3.

## Tasks

### [ ] T1 — Schema + engine core
Tables, migration, `question-types.ts`, `retry.ts`, `generation.ts` (server parts), generate route skeleton, `useSessionGeneration` hook.
**Accept:** unit tests: retry selection rules (never re-serve correct, 30 % cap), idempotent group generation, operation shared across groups (budget blocks mid-session → remaining groups `failed`, session still playable with what exists).

### [ ] T2 — Grammar mastery (`lib/grammar/mastery.ts`)
`masteryFor(grammarId)`: last 10 attempts on questions whose `grammar_ids` contain it (any source). `not_tested` (0 attempts), `learning`, `mastered` (≥ 5 attempts and ≥ 80 % correct). Batched query for lists. Show badge on `/grammar` list and fill the lesson page mastery card (ring with % of the last 10, state label, strip of the last 10 attempts in level-2 / level-0).
**Accept:** unit tests on thresholds.

### [ ] T3 — Config page `/tests/grammar`
- Select lessons (searchable multi-select) + quick picks: "Weakest 5" (learning with lowest accuracy, then not_tested), "Last added 5", "Level N".
- Count 5–20 (default 10); types checkboxes (default all four); cost estimate (≈ groups × per-group estimate) and budget check; Start.
- Also a "Test this lesson" button on each lesson page (preselects it).

### [ ] T4 — Generation & verification
Prompts + routes; groups of ≤ 5; verification; fixtures `grammar.test_generate.json`, `grammar.test_verify.json`, `grammar.grade_translation.json`.
**Accept:** AI_MOCK e2e: create test → groups generate → questions appear.

### [ ] T5 — Runner `/tests/grammar/[sessionId]`
- One question at a time; MCQ options as large tap targets; conjugate/translate with Korean input (IME rule).
- Confirm → `POST answer` → grading (AI for translate, spinner) → feedback: correct/wrong, right answer, explanation, link "open lesson" (opens lesson in a drawer, not a navigation).
- Attempts saved per answer; `markResult` applied; session resumable.
- End ("Session results" layout): score %, `session-summary` (plan 00c), per-lesson % table (`LedgerRow`s coloured by the scale), mastery changes (state badge before → after), "retry failed questions" (new session from retry pool only, no AI cost).
**Accept:** e2e full run with mocks; mastery badge updates.

## Definition of Done
Owner can pick 2 lessons, get 10 verified questions mixing the 4 types, see explanations, and failed questions come back in later tests. Engine is generic enough that plan 04 only registers new types and a new generation step. lint/typecheck/test/build green.
