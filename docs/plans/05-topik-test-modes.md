# Plan 05 — TOPIK test modes, instant lookups, stats (EPIC 3, part 2)

**Goal:** take TOPIK tests in **blank** mode (tap any word → instant translation + grammar, add missing items from a drawer, immediate feedback) or **serious** mode (timer, no help, results at the end), and track success per question type. Also a unified stats page for all three test kinds.

**Depends on:** 04.

---

## 1. Library cache (instant lookups)

- `GET /api/library/index?language=ko` → `{ words: [{ id, term, meanings, type, level, example_sentence, example_translation }], grammar: [{ id, title, pattern, variants, meaning_short, level, description_md, formation_md, examples, similar_md }], version }`. ~700 words + ~100s lessons ≈ well under 1 MB; gzip on.
- Client store `useLibrary()` (TanStack Query, `staleTime: Infinity`), built into maps: `wordsByNormTerm: Map<string, Word[]>`, `wordsById`, `grammarById`.
- After any add/edit from the drawer → optimistic update of the cache (no refetch needed).
- Lookups never hit the network when the token is annotated: tap → map lookups → render. Target < 50 ms.

## 2. Data model additions

`word_lookups`
- `id`, `user_id`, `word_id`, `session_id`, `surface` text, `created_at`
- unique (`session_id`, `word_id`) — one reset per word per session.

`test_sessions` for topik: `config = { exam, mode, counts: Record<catalogId, number>, plan, operationId }`, `time_limit_s` set in serious mode.

---

## 3. Tasks

### [ ] T1 — Config page `/tests/topik`
- Exam: derived from target level (badge "TOPIK II — target level 4"), switch to override. If no target level: inline selector that also saves it to the profile.
- Mode: **Blank** (help + immediate feedback) / **Serious** (timer, no help).
- Per question type (visible catalog types only): stepper 0–10, grouped like the paper, with the official item numbers and the Korean instruction as subtitle. Presets: "Quick 10" (mixed singles), "Pairs practice", "Full section (text-only)".
- Shows: total questions, retry questions available, serious-mode time (`count × pace`), **cost estimate**, budget status. Start → creates session (plan 04 planner) → runner.

### [ ] T2 — Runner shell `/tests/topik/[sessionId]`
- Layout mobile: passage on top (scrollable), sub-prompt + 4 options below, sticky footer (prev / question palette / next). Desktop: passage left, question right.
- Paired questions share one passage view; palette shows groups.
- Generation progress (from plan 03 hook): questions not yet generated show a skeleton; user can answer the ready ones first.
- Rendering of markers: `( ㉠ )` highlighted chip, `(가)` blocks for ordering, `<u>` underline, headline in a styled box, given sentence in a callout.
- Session resumable (answers persisted); "Abandon" button.

### [ ] T3 — Serious mode
- Countdown from `time_limit_s` stored server-side with `started_at` (refresh-proof: remaining = limit − (now − started_at)). Warning at 5 min and 1 min. Auto-submit at 0.
- Answers saved on every selection (`upsert` attempt, `final=false`), finalized on submit. Tokens are **not** tappable; no drawer; no explanations until the end.
- Submit → grading → results page.

### [ ] T4 — Blank mode: tappable tokens + drawer
- Each eojeol rendered as a tappable span (passage, given sentence, stems, options). Tapped token highlighted.
- Drawer (`components/lookup/LookupDrawer.tsx`): shadcn **Drawer** (bottom sheet) under 768 px — opens over the test, half-height, draggable to full; **Sheet** (right panel) on desktop so the passage stays visible. Test state untouched.
- Content for a token:
  - Surface + for each lemma: lemma, pos, gloss. If the lemma is in the library: meanings, level dots, example + translation, link "open word". If several homonyms: list them, highlight the one whose meanings best match the gloss.
  - **Lookup side effect:** if an existing word is shown → `POST /api/lookups` (records `word_lookups`, applies `resetToZero` once per session). Silent, no UI blocking.
  - Not in library → **"Add to my words"** (T5).
  - Grammar pieces: mapped → title, meaning_short, expandable full lesson (rendered from cache), link "open lesson"; unmapped → pattern + meaning from annotation + **"Add grammar lesson"** (T6).
  - Footer: "Analysis looks wrong? Re-analyze" → fallback (T7).
- Token with `null` annotation (alignment failed) → fallback runs automatically on tap with a spinner.

### [ ] T5 — Add word from drawer
- Inline form prefilled: term = lemma, meanings = [gloss], type = pos.
- Example: on open, auto-call task `words.example_sentence` (fast tier, ~$0.001): `{ example_sentence, example_translation }` — simple sentence at the user's target level using the word naturally. Buttons: "Regenerate", "Use sentence from passage" (the sentence containing the token + AI translation in the same call: the task returns both variants), or edit by hand.
- Save → `source = topik_lookup`, level 0, due now → cache updated → token now shows "in your words".
- Fixtures: `words.example_sentence.json`, `topik.lookup_token.json`.

### [ ] T6 — Add grammar from drawer
- Prefilled with pattern + meaning from the annotation and the passage sentence as example.
- "Generate lesson" → plan 02 `grammar.structure` with notes = pattern + meaning + example → `GrammarDraftReview` (compact) inside the drawer → Save / Rewrite / Discard (review is mandatory, as in plan 02).
- After save: update cache; patch `topik_passages.annotations` of the current passage replacing `code: null` entries with the same normalized pattern by the new id (so future views map it).

### [ ] T7 — Fallback on-tap lookup (option C)
- `POST /api/lookup` `{ sessionId, passageId, textKey, tokenIndex, sentence, surface }` → task `topik.lookup_token` (fast tier) → returns one `Token` (same schema as annotation) → post-processed (resolve ids) → persisted into the passage annotations at that index → returned.
- Target latency 1–3 s; small per-request estimate.

### [ ] T8 — Blank-mode answering
- Select option → "Check" → result immediately: correct/wrong, correct option, explanation, grammar used (chips opening the drawer). Attempt saved; `markResult` (retry pool).
- Questions can be answered in any order; finishing → results page.

### [ ] T9 — Results page `/tests/topik/[sessionId]/results`
- Score, time used (serious), success % **per question type** for this session, list of all questions with chosen vs correct, explanation (expandable), passage view (tokens tappable here too, even after serious mode).
- Failed questions → retry pool (automatic). Words looked up → listed ("these words are back to level 0").
- Buttons: "Retry failed questions" (no AI cost), "New test with same settings".

### [ ] T10 — Stats `/stats` (all test kinds)
- Tabs: TOPIK / Grammar / Words.
- TOPIK: table per question type — attempts, success % all time, last 30 days, trend arrow; line chart of session score % over time (filter exam, mode).
- Grammar: mastery distribution, weakest lessons.
- Words: count per level, due today, known words (level ≥ 2), words with missing example.
- Queries in `lib/stats/*.ts`, unit-tested on PGlite.

### [ ] T11 — Home integration
Home cards: resume unfinished session, due words count, quick "TOPIK quick 10", "Grammar: weakest 5".

### [ ] T12 — E2E (AI_MOCK)
Blank mode: start test, tap an annotated token (instant), add a word from drawer, answer with feedback, finish, results show per-type %. Serious mode: timer visible, tokens not tappable, auto-submit with fake timers.

## Definition of Done
On the phone: start a 10-question TOPIK test in blank mode, tap any word and get the info instantly, add a missing word and a missing grammar lesson without leaving the test, finish and see per-type results; serious mode times out correctly; stats show history. lint/typecheck/test/build green.
