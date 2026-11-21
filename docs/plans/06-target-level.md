# Plan 06 — Target level alignment (EPIC 4)

**Goal:** an "Align language content" feature that compares the library against a reference list for the target level, reports coverage, and proposes small batches of missing words (max 30) and grammar (max 3) into a review queue — with cost estimates and budget enforcement.

**Depends on:** 05 (uses known-word / mastery definitions, grammar structuring, AI layer). The target level setting already exists (plan 00).

---

## 1. Reference data

`reference_items` (not user-scoped content, but keep `user_id` for simplicity/single user)
- `id`, `user_id`, `language`, `exam`, `kind` `word | grammar`
- `level` smallint (1–6), `term` text (word lemma or grammar pattern, NFC), `match_key` text (normalized)
- `pos` text null, `meaning_en` text null, `frequency_rank` int null
- `source` text `csv:<name> | ai_generated`
- unique (`user_id`, `language`, `kind`, `match_key`)

`reference_ignores` — (`user_id`, `reference_item_id`) items the user rejected; never proposed again.

`reference_grammar_matches` — cache of fuzzy matches: (`reference_item_id`, `grammar_id` null, `checked_at`).

### Sources (in order of preference)
1. **CSV import** (`/settings/reference`): file + column mapping (term, level, pos, meaning, frequency). Level mapping helper for 3-band lists: A → 1–2, B → 3–4, C → 5–6 (owner chooses the exact mapping in the UI; default A=2, B=4, C=6, meaning "needed by"). Suggested sources for the owner to obtain (add to HUMAN_TODO): the National Institute of Korean Language learner vocabulary list (graded A/B/C) and the International Standard Korean Curriculum grammar items (levels 1–6). Check the license/terms before use; files are **not** committed to the public repo (store via upload only).
2. **AI-generated fallback** (`reference.generate`, smart tier), per level and kind, run once and stored, labelled "AI-generated (less reliable)":
   - Grammar: list of patterns expected at TOPIK level L (`{ pattern, meaning_en }[]`), one call per level.
   - Words: by theme (a fixed list of ~25 themes × level) → `{ term, pos, meaning_en }[]` chunks of ~80. Show the total estimate before running; can run level by level.
3. No scraping of exam papers (decided: too fragile; CSV is the "ask the user" path).

## 2. Gap analysis (`lib/align/gap.ts`, pure)
Input: target level T, reference items with level ≤ T (minus ignored), active words, active grammar, mastery data.
- Words: matched if any active word has `normKo(term) === match_key`. Status per reference item: `known` (matched word with level ≥ 2), `stored` (matched, level < 2), `missing`.
- Grammar: matched if `match_key` ∈ any lesson's `match_keys`; else look in `reference_grammar_matches`; unresolved missing grammar items are checked once with task `align.grammar_match` (fast tier): given the unmatched patterns and the compact lesson list, return equivalences; cache results. Status: `known` (mastered), `stored`, `missing`.
- Report per level 1…T and total: counts + % for words and grammar.

## 3. Batch proposal
- Settings: `align_batch_words` (default 30, max 30), `align_batch_grammar` (default 3, max 3).
- Selection: missing items, lowest level first, then `frequency_rank` asc (null last), then alphabetical.
- **Blocked** while the review queue (status `suggested`) is not empty → message "Review your N pending suggestions first".
- Before running: cost estimate + budget check, confirm dialog.
- Enrichment:
  - Words → task `align.enrich_words` (smart tier, one call for ≤ 30): `{ term, meanings[], type, example_sentence, example_translation }[]` — simple examples at the item's level.
  - Grammar → plan 02 `grammar.structure` per item (notes = pattern + meaning + level), up to 3 calls.
- Results inserted with `status = suggested`, `source = alignment`.

## 4. Tasks

### [ ] T1 — Schema + CSV reference import
Tables, migration, `/settings/reference` page (import, list counts per level/kind/source, delete a source).
**Accept:** CSV with A/B/C levels imported and mapped; duplicates merged by match_key.

### [ ] T2 — AI reference generation (fallback)
Task + prompts + fixtures; UI buttons per level/kind with estimate; stores items.

### [ ] T3 — Gap analysis + grammar fuzzy match
`gap.ts` with tests (known/stored/missing, ignored excluded, levels ≤ T); `align.grammar_match` task with cache.

### [ ] T4 — Align page `/settings/align` ("Align language content")
- Target level shown (editable link). Coverage report: per level, words & grammar bars (known / stored / missing) and totals.
- "Propose next batch" button (disabled with reason when queue non-empty or no reference data; link to T1/T2 then).
- Monthly spend + remaining budget shown.

### [ ] T5 — Batch run + review queue `/review`
- Run the enrichment described in section 3 as one budget operation.
- Review page: words table (editable inline: term, meanings, type, example, translation) with Accept / Reject per row and "Accept all"; grammar drafts with `GrammarDraftReview` (Save → active, Discard → reject).
- Accept → `status = active`, level 0, due now. Reject → delete suggestion + add `reference_ignores`.
- Badge in nav when suggestions are pending.

### [ ] T6 — Fixtures + e2e
Fixtures `reference.generate.json`, `align.grammar_match.json`, `align.enrich_words.json`. E2E: import a small CSV → report → propose batch → accept 2 words, reject 1, save 1 grammar → coverage updates.

## Definition of Done
Owner sets target level 4, imports (or generates) reference lists, sees coverage, gets ≤ 30 words + ≤ 3 lessons per batch within budget, reviews them, and accepted items enter the word tests and grammar library. lint/typecheck/test/build green.
