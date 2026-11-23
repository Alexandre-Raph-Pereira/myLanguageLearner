# Plan 02 — Grammar (EPIC 2)

**Goal:** a grammar library. Lessons are created by hand, from pasted notes, or from notebook photos; the AI structures them into a fixed template; the user always reviews (Save / Rewrite / Discard) before anything is stored.

**Depends on:** 00c (design system + `recordActivity`; uses `content_status`, `content_source` enums from 01 — if 01 is not merged yet, define the enums in `db/schema/enums.ts` and have 01 import them).

---

## Data model (`db/schema/grammar.ts`)

`grammar_points`
- `id` uuid, `user_id`, `language`
- `title` text — e.g. `-(으)ㄹ 수 있다`
- `pattern` text — canonical form
- `variants` text[] — surface forms used for matching/annotation, e.g. `['-ㄹ 수 있다','-을 수 있다','-ㄹ 수 없다','-을 수 없다']`
- `match_keys` text[] — normalized `pattern` + `variants` (computed on save)
- `meaning_short` text — one line, English
- `level` smallint null (estimated TOPIK level 1–6)
- `description_md` text, `formation_md` text (how it attaches: consonant/vowel stems, irregulars, tense)
- `examples` jsonb `[{ ko, en }]` (≥ 2)
- `similar_md` text — "Similar expressions / Be careful"
- `status` content_status default `active`, `source` content_source (shared enum from `db/schema/enums.ts`)
- `created_at`, `updated_at`
- index (`user_id`, `language`), GIN index on `match_keys`

`grammar_links`
- `grammar_id`, `related_id` (both → grammar_points, cascade), `kind` text `similar | contrast | prerequisite`, `note` text null
- PK (`grammar_id`, `related_id`); store both directions on save.

Zod `GrammarDraft` (`lib/grammar/schema.ts`) = all editable fields above + `related: [{ ref: string, kind, note? }]` where `ref` is a short code of an existing lesson (see prompts).

### `lib/grammar/normalize.ts`
`normPattern(s)`: NFC, trim, remove spaces, unify leading `~`, `–`, `—`, `-` → `-`, remove a leading `-` for comparison, lowercase Latin. `matchKeys(draft)`. `findPossibleDuplicates(draft, existing)` → lessons sharing any match key.

---

## AI tasks (prompts in `lib/ai/prompts/grammar.ts`)

### `grammar.structure` (tier smart)
Input: notes text **or** one image; target language; native language; target level; compact list of existing lessons `G1: -아/어서 — because/and then` (codes G1…Gn are mapped back to ids server-side).
Output: `{ drafts: GrammarDraft[] }` (a page may contain several lessons).
Rules:
- Keep the user's explanations and examples; correct obvious mistakes; complete missing sections (description, formation, ≥ 3 examples with translations, similar/careful).
- Explanations in the native language, concise, learner-friendly; Korean in NFC.
- `variants` must list every surface form a learner would meet (consonant/vowel stem forms, negative/past forms when common).
- `related`: only codes from the provided list.
- Estimate `level` 1–6 or null.

### `grammar.rewrite` (tier smart)
Input: current draft (including the user's manual edits) + optional instruction ("shorter description", "more casual examples"). Output: one `GrammarDraft`. Rules: change only what the instruction asks; keep user edits unless asked otherwise.

---

## Design & progress hooks
Canvas screen: **Grammar lesson** (DESIGN.md §5). Patterns, variants and examples always render in the target-language font (`<T lang>`).
- Events: **"Mark as studied today"** button on the lesson page → `grammar_credit` (+10, `dedupe_key` = `grammar_credit:<lessonId>:<localDate>`; the button then shows "Studied today — counts as today's grammar lesson"); saving a new lesson from review → same `grammar_credit` event.
- Until plan 03 ships, the mastery card shows "Not tested yet" (muted); plan 03 fills it.

## Tasks

### [x] T1 — Schema, normalization, queries
- Tables + migration; `lib/grammar/queries.ts`: list (search title/pattern/meaning, level filter, status), get with links, create (computes match_keys, writes links both ways), update, delete, `compactListForPrompt(userId, language)` → `{ code, id, title, meaning_short }[]`, `libraryIndex` (id, title, pattern, variants, meaning_short, level, description_md, examples — for plan 05 cache).
- **Accept:** PGlite tests: create with links, dedupe detection, match keys.

### [x] T2 — Library & lesson pages
- `/grammar`: list cards (title in the target font, meaning_short, TOPIK level chip, mastery badge slot for plan 03 coloured by the scale, "studied today" tick), search, level filter.
- `/grammar/[id]` (canvas "Grammar lesson"): title (target font, 34 px) + meaning (Fraunces), level chip, **mastery card** (`ProgressRing` + state + last-10 attempt strip — slot until plan 03), "Mark as studied today" / "Studied today" row (`good-soft`), Formation card (react-markdown), Examples card (KR/EN, pattern occurrence in `brass-text` bold via simple match on variants), "Similar · be careful" dashed card with related lessons as chips (links), bottom actions Edit / **Test this lesson** (enabled by plan 03) / Delete in an overflow menu.
- `/grammar/[id]/edit`: same form as review (T4).
- **Accept:** mobile layout readable; markdown renders.

### [x] T3 — Import entry (`/grammar/new`)
Tabs:
1. **Write** — empty form (manual, no AI) with an optional "Complete with AI" button (sends the partial form as notes to `grammar.structure`).
2. **From text** — textarea for notes → "Structure with AI".
3. **From photo** — up to 5 images, client resize as in plan 01, one request per image → drafts appended.
Route handlers `POST /api/grammar/structure`, `POST /api/grammar/rewrite` (`maxDuration` 60), each one AI operation, cost estimate shown before the call (tooltip/inline "≈ $0.0x").

### [x] T4 — Review screen (shared component `GrammarDraftReview`)
- One editable card per draft: all fields (variants as tag input, examples as editable rows, markdown fields with preview toggle), related lessons picker (search existing).
- Duplicate warning banner if `findPossibleDuplicates` hits, with link to the existing lesson and choice "save anyway" / "discard".
- Actions: **Save** (stores, `source` from origin), **Rewrite** (opens instruction textarea, calls `grammar.rewrite`, replaces the draft; keep the previous version for one-step **Undo**), **Discard**.
- Nothing is saved without an explicit Save. Unsaved drafts survive a page refresh (sessionStorage).
- Component must also work inside a narrow drawer (used by plan 05) — props `compact`.
- **Accept:** e2e with AI_MOCK: paste text → 2 drafts → rewrite one → save both → appear in library with links.

### [x] T5 — Fixtures
`grammar.structure.json` (2 drafts, one with a `related` code), `grammar.rewrite.json`.

### [x] T6 — Import hand-written lesson files (no AI)
Lessons can be written by hand in `content/grammar/<lang>/*.md` (format: `content/grammar/TEMPLATE.md`, parser: `lib/grammar/lesson-file.ts`).
- `pnpm grammar:import [--update]` (`db/import-grammar.ts` → `lib/grammar/import-files.ts`): user = `GRAMMAR_IMPORT_USER_ID` ?? `NO_LOGIN_USER_ID` ?? `DEV_USER_ID`. Matches lessons by pattern: new → created (`source = import_text`), existing → skipped (or overwritten with `--update`, links kept). `related` patterns → `grammar_links` both ways (additive); missing ones are printed and linked on a later run.
- **Accept:** PGlite test: importing twice → one lesson each; links created; `--update` keeps links.

---

## Out of scope
Grammar exercises (plan 03), audio.

## Definition of Done
Owner can photograph a notebook lesson, get a structured draft, rewrite it with an instruction, save it, and browse it on the phone. lint/typecheck/test/build green.
