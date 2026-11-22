# Plan 01 — Words (EPIC 1)

**Goal:** a word bank with example sentences, a spaced-repetition word test (EN→KR / KR→EN / mixed), CSV/TSV import (Quizlet export, ~700 words) and notebook-photo import.

**Depends on:** 00c (design system + `recordActivity`).

---

## Data model (`db/schema/words.ts`)

Enum `word_type`: `noun, verb, adjective, adverb, pronoun, numeral, determiner, particle, counter, interjection, expression, other`.
Enum `content_status`: `active, suggested` (suggested = waiting in a review queue, used by plan 06; excluded from tests and lists by default).
Enum `content_source`: `manual, import_csv, import_text, import_photo, topik_lookup, alignment` (shared with grammar; define in `db/schema/enums.ts`).

`words`
- `id` uuid PK, `user_id`, `language`
- `term` text (dictionary form, NFC), `meanings` text[] (≥1, first = primary, accepted answers)
- `meaning_key` text (normalized primary meaning, for uniqueness)
- `type` word_type default `other`
- `example_sentence` text null, `example_translation` text null
- `notes` text null
- `level` smallint 0–3 default 0, `interval_days` int default 0, `due_at` timestamptz default now()
- `last_reviewed_at` null, `correct_streak` int 0, `times_correct` int 0, `times_failed` int 0, `times_looked_up` int 0
- `status` content_status default `active`, `source` content_source
- `created_at`, `updated_at`
- unique (`user_id`, `language`, `term`, `meaning_key`); index (`user_id`, `language`, `term`); index (`user_id`, `language`, `due_at`)
- "needs example" = `example_sentence is null` (no extra column).

`test_sessions` (generic, reused by plans 03–05)
- `id` uuid, `user_id`, `language`
- `kind` text: `word | grammar | topik`; `mode` text null (`blank | serious` for topik)
- `config` jsonb (filters, direction, counts…)
- `status` text: `generating | ready | in_progress | finished | abandoned`
- `started_at`, `finished_at` null, `time_limit_s` int null
- `score_correct` int 0, `score_total` int 0

`word_reviews`
- `id`, `user_id`, `session_id` → test_sessions, `word_id` → words (cascade)
- `direction` text `en_ko | ko_en`, `answer` text, `result` text `correct | wrong | alternative | override`
- `created_at`

---

## Domain logic (pure, fully unit-tested)

### `lib/words/scheduler.ts`
```
INTERVALS = { 1: 1, 2: 3, 3: 7 }  // days
onCorrect(w, now): level = min(level+1, 3);
   interval = level < 3 ? INTERVALS[level]
            : (w.level === 3 ? min(max(w.interval_days,7) * 2, 120) : 7)
   due_at = now + interval days; correct_streak++, times_correct++, last_reviewed_at = now
onWrong(w, now): level 0, interval 0, due_at = now, correct_streak 0, times_failed++, last_reviewed_at = now
resetToZero(w, now, reason: 'lookup'): level 0, interval 0, due_at = now, correct_streak 0, times_looked_up++ (used by plan 05)
isKnown(w) = level >= 2
```

### `lib/words/select.ts`
`selectWords(candidates, { count = 25, now, rng })`:
1. `due = candidates.filter(due_at <= now)`; weight = `4 - level` (level 0 → 4 … level 3 → 1).
2. Weighted random sampling without replacement from `due` up to `count`.
3. If fewer than `count`, fill with not-due words ordered by `due_at` asc.
4. Shuffle final order. `rng` injectable (seeded in tests).

### `lib/text/normalize.ts` + `lib/words/answer.ts`
- `normKo(s)`: NFC, trim, remove all whitespace, strip trailing `.?!~` and quotes.
- `normEn(s)`: NFC, lowercase, trim, collapse spaces, remove punctuation except apostrophes/hyphens, strip leading `to `, strip leading articles `a |an |the `.
- `checkAnswer({ word, direction, answer, bank })` →
  - `en_ko`: correct if `normKo(answer) === normKo(word.term)`. Else if another active word in the bank has `normKo(term) === normKo(answer)` **and** shares a normalized meaning → `alternative`. Else `wrong`.
  - `ko_en`: correct if `normEn(answer)` equals `normEn` of any meaning. Else `wrong`.
- Tests: NFD vs NFC Hangul input, spaces inside Korean (`공부 하다` = `공부하다`), "to eat" vs "eat", "The book", trailing punctuation, homonyms.

---

## Design & progress hooks
Canvas screens (DESIGN.md §5): **Words library**, **Word test — feedback**, **Session results**, Home ledger rows.
- Level colours everywhere come from `levelStep(level)`; levels are always shown as "Lv n" next to the colour.
- Events (`recordActivity`, inside the same server action as the review):
  - every answer → `word_answer` (`ref_id` = word, `dedupe_key` = `word_answer:<reviewId>`, points 10 if `correct`/`alternative`, 0 if `wrong`); "I was right" → `adjustActivity` to 10.
  - level goes from < 2 to 2 → `word_known` (+5, `dedupe_key` = `word_known:<wordId>:<reviewId>`).
- Snapshot sources registered for plan 00c: `wordsKnown` (count level ≥ 2), ledger rows "Words known" (`known / total`) and "Due today" (`answered today / due at start of day`), test tile `lastScore.word`.

## Tasks

### [ ] T1 — Schema + queries
- Tables above + migration. `lib/words/queries.ts` (all scoped by userId/language): list with filters (search on term/meanings ILIKE, type[], level[], needsExample, status), get, create, update, delete, bulkInsert, findDuplicates(rows), libraryIndex (id, term, meanings, type, level — used by plan 05).
- **Accept:** PGlite tests for CRUD, uniqueness with homonyms, filters.

### [ ] T2 — Word library UI
- `/words` (canvas "Words library"): title + "N words · K known (P %)", `LevelBar` of the whole bank, search box, filter chips with level-colour dots and counts (all, Lv 0–3, type, "no example · N"), a `HeroPanel` card "N words due — today's goal x / y — Start test", list rows (term in the target font, primary meaning, type chip, `LevelPips` + "Lv n", "no example" flag in `level-1-text`). Infinite scroll or pagination (50).
- `/words/new` and `/words/[id]`: form (term, meanings as tag input, type select, example + translation, notes), level shown read-only with "reset to 0" button. Delete with confirm.
- Header actions: Add, Import (CSV), Import (photo), Start test.
- **Accept:** create/edit/delete works on mobile width; zod validation messages.

### [ ] T3 — Scheduler, selection, answer checking
- Implement `lib/words/scheduler.ts`, `select.ts`, `answer.ts`, `lib/text/normalize.ts` with tests above.
- **Accept:** ≥ 95 % line coverage on these files.

### [ ] T4 — Word test
- `/tests/words` params page: types (multi-select, default all), direction (`en_ko` default, `ko_en`, `mixed`), count (5–50, default 25), checkbox "include words without example". Shows "N due / M total matching".
- Start → server action creates `test_sessions` (kind `word`, config, list of selected word ids + direction per item in `config.items`) → redirect `/tests/words/[sessionId]`.
- Runner (canvas "Word test — feedback"; one card at a time): header with quit button, brass progress bar, "n/25"; sub-line with in-session streak and accuracy %.
  - Prompt: `en_ko` shows all meanings + type badge; `ko_en` shows term + type.
  - Input autofocus, `lang="ko"` for Korean answers, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="none"`, **Enter ignored while `isComposing`**.
  - Submit → server action `answerWord(sessionId, index, answer)`: checks, writes `word_reviews`, applies scheduler (`alternative` → no change), returns result.
  - Feedback panel (`FeedbackPanel`: `good-soft` / `wrong-soft`): correct/wrong/alternative, expected answer, `LevelTransition` (e.g. Lv 1 → Lv 2 · Known, or Lv 2 → Lv 0) + "next review in N days" / "back in today's review", points gained, **example sentence + translation** (always shown after answering), buttons "Next" and **"I was right"** (sets result `override`, applies onCorrect instead; for `ko_en` checkbox "add my answer as accepted meaning"). Mini daily-goal bar above the Next button.
  - Answers are persisted one by one, so leaving mid-test keeps progress; session can be resumed from Home.
- End screen (canvas "Session results"): score % in Fraunces 88 px (scale colour) + "x of n correct", `session-summary` from plan 00c (goal-met banner, points breakdown, rank progress, milestone toasts), **level movement** = two `LevelBar`s (before / after) for the session's words, list of failed words (with links), "Retry the N missed words" (new session with those ids) and "Back to home".
- **Accept:** e2e smoke on seeded data: run a 5-word test, fail one, level resets to 0, pass one, level increments, due date set.

### [ ] T5 — CSV/TSV import (`/words/import`)
- Input: paste textarea **or** file (.csv/.tsv/.txt). Parse with papaparse.
- Options: separator (auto-detect tab/comma/semicolon, or custom), "first row is header", meaning split on `;` (default on), `,` (default off), `/` (default off).
- Column mapping UI: term, meaning, example_sentence, example_translation, type (each column can be ignored). Default mapping for 2 columns = term, meaning (Quizlet export); 3 columns = term, meaning, example.
- Type column values mapped: English names, Korean (`명사 noun, 동사 verb, 형용사 adjective, 부사 adverb, 대명사 pronoun, 수사 numeral, 관형사 determiner, 조사 particle, 감탄사 interjection, 표현 expression`), unknown → `other`.
- Preview table (`components/words/ImportPreview.tsx`, reused by photo import): each row editable inline; status badge: `new`, `duplicate` (same term + meaning_key exists or appears twice in the file → skipped by default, toggle "update existing example/meanings"), `invalid` (missing term or meaning), `missing example` (flag only — **do not generate**). Bulk "set type for selected".
- Optional button **"Suggest types with AI"** (fast tier, task `words.suggest_types`): sends `{i, term, meaning}` for rows with type `other` in chunks of 200, returns `{i, type}[]`; one operation; shows cost estimate first.
- Import button → transaction, batches of 500, `source = import_csv`, level 0, due now. Result summary: inserted / updated / skipped.
- **Accept:** unit tests for parsing (Quizlet tab export, quoted commas, Korean NFC), mapping, duplicate detection; e2e import of a 10-row fixture.

### [ ] T6 — Photo import (`/words/import/photo`)
- Pick up to 5 images (camera allowed on mobile: `accept="image/*" capture` optional). Client-side resize with canvas to max 2000 px long side, JPEG q≈0.85 (keep each < ~1.5 MB — Vercel request body limit is 4.5 MB). Send **one image per request**, sequentially, with progress.
- Route `POST /api/words/photo-extract` (`maxDuration` 60): `aiObject` tier smart, task `words.photo_extract`, schema `{ entries: [{ term, meanings: string[], example_sentence?, example_translation?, type?, confidence: 'high'|'low' }] }`.
- Prompt rules: transcribe exactly what is written; Korean in NFC; do not invent words, meanings or examples that are not on the page; mark unclear handwriting `low`; skip crossed-out items; if a verb/adjective is written conjugated, keep as written and set `confidence: 'low'`.
- Results merged into the same Import Preview (low-confidence rows highlighted). Images are **not stored**.
- **Accept:** mock-fixture test of the route; UI flow works with AI_MOCK.

### [ ] T7 — Dev seed + fixtures
- `pnpm db:seed` adds ~40 Korean words of mixed types/levels for the dev user.
- AI fixtures: `words.photo_extract.json`, `words.suggest_types.json`.

---

## Out of scope
Audio/pronunciation, images on cards, AI-generated example sentences on import (owner flags them instead), offline.

## Definition of Done
- Owner can paste the Quizlet export (~700 rows), review, import; take a 25-word EN→KR test on the phone with correct IME behaviour; levels/due dates update per the rules; photo import produces an editable preview.
- lint/typecheck/test/build green.
