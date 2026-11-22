# myLanguageLearner — Vision & product decisions

## Why
Duolingo and Quizlet lack good grammar explanations, words without example sentences give no context, and word tests alone teach nothing new. This app combines: a vocabulary bank with context, a grammar library, and AI-generated exam practice (TOPIK) built from the learner's own words and grammar.

## Scope & constraints
- Web app on **Vercel**, installed as a **PWA** on the phone. **Online only** (no offline mode).
- **Single user** (the owner). If anyone else ever uses it, it still runs on the owner's AI key. Login exists only to protect the deployment.
- Languages: **Korean** first; French / English may be added later (**max 3 languages**). Every content row carries a `language`. Translations/explanations are in **English** (native language setting, default `en`).
- AI provider is **swappable** (Anthropic / OpenAI / Google via the Vercel AI SDK). Start with **Claude Sonnet 5.x** (`claude-sonnet-5-5`, set in env). Two tiers: `smart` (generation) and `fast` (verification, annotation, small tasks) — both default to the same model, can be changed in Settings.
- **Budgets:** a per-request cap (one user action, which may contain several AI calls) and a monthly cap, both set in Settings. Every AI call is estimated before (upper bound) and logged after with real cost.

## Feature map (in build order)
| Plan | Feature |
|---|---|
| 00 | Foundation: scaffold, auth, DB, AI layer with budgets, settings (incl. **target TOPIK level**), app shell, PWA |
| 00b | **Design system**: Navy & Cream light/dark themes, fonts, progress colour scale, shared progress components, restyled shell |
| 00c | **Progress & motivation**: daily goal, streak, points, ranks, milestones; Home dashboard |
| 01 | **Words** (EPIC 1): word bank, spaced-repetition word test, CSV/TSV import (Quizlet export), notebook-photo import |
| 02 | **Grammar** (EPIC 2): grammar library, AI structuring from text/photo, review → save/rewrite |
| 03 | **Grammar test** (new): AI-generated tests on chosen grammar lessons; shared test engine (question bank, retry pool, sessions) |
| 04 | **TOPIK generation** (EPIC 3, part 1): question-type catalog, generation + verification + annotation pipeline |
| 05 | **TOPIK test modes** (EPIC 3, part 2): blank mode with instant lookups + add-from-drawer, serious mode with timer, results & stats |
| 06 | **Target level alignment** (EPIC 4): reference lists, gap analysis, batch suggestions with review |
| later | New EPIC(s) for complex TOPIK items (graphs, posters, ads), written by the owner |

The app ends with three test types: **Word test**, **Grammar test**, **TOPIK test**.

## Decisions — Design & motivation
Full spec: `docs/DESIGN.md`. Mockups: Claude Design canvas "myLanguageLearner redesign", page "Navy & Cream — chosen".
- Visual direction **Navy & Cream** (chosen 2026-11-22 over a Korean-inspired and a graphite proposal): grown-up, editorial; works for Korean and the future languages. Light (cream) and dark (navy) themes; follows the system by default, switchable in the header and Settings.
- Fonts: Fraunces (display/numbers), Inter (UI), a **per-language target font** (Noto Serif KR for Korean).
- Progress is shown with **percentages and one 4-step colour scale** (rust → ochre → teal → navy) shared by word levels 0–3 and all percentages (< 40 / 40–59 / 60–79 / ≥ 80 %). Colour is never the only signal: numbers are always shown.
- Motivation: **daily goal = 20 word answers + 1 grammar lesson** (editable), **streak** of days with the goal met (no freezes), **points** for correct work, **ranks** by cumulative points, **24 milestones**. No leaderboards, no mascots, no notifications (online PWA only).
- Keep the existing navigation: bottom tab bar on mobile, sidebar on desktop (Home, Words, Grammar, Tests, Settings).

## Decisions — Words (EPIC 1)
- Word = term (dictionary form), meanings[] (accepted English answers; first = primary), type, example sentence + translation, level 0–3, schedule.
- Homonyms allowed: uniqueness is term + primary meaning, not term alone.
- **Level 0–3 is shown to the user, with a time-based schedule behind it**: correct → level +1 (max 3) and next review in 1 / 3 / 7 days, then the interval doubles at level 3 (cap 120 days). **Fail → back to level 0**, due immediately.
- **Known word = level ≥ 2** (typed correctly at least twice in a row since the last failure).
- Test: 25 words by default, weighted-random among due words (lower level = more likely), filtered by type (default all). Directions: **EN→KR (default, user types Korean)**, KR→EN, or mixed. One level per word shared by both directions.
- Answer checking tolerant to spacing/punctuation/case; "I was right" override; another word of the bank with the same meaning counts as "valid alternative" (no level change).
- Import: **CSV/TSV paste or file** (Quizlet export, ~700 words, owner provides term + translation + example). Missing example sentences are **flagged, not AI-generated**. Optional AI type suggestion. **Notebook photo** import via vision model, always through a review table before saving.

## Decisions — Grammar (EPIC 2)
- Lesson template: title, pattern, variants (surface forms used for matching), short meaning, level estimate, description, formation rules, examples (KR + EN), "similar expressions / be careful", links to related lessons.
- Import from typed text or notebook photo → AI returns draft(s) → **user must review**; actions: Save / Rewrite (with optional instruction) / Discard. AI-filled fields are not marked differently — review is the safeguard.

## Decisions — Grammar test (new, between EPIC 2 and 3)
- Pick lessons (or quick picks: weakest / recent / by level), 5–20 questions, question types: blank MCQ, conjugation (typed), choose the correct sentence, translate-with-grammar (AI-graded).
- Immediate feedback with explanation and link to the lesson.
- **Known grammar = ≥ 5 attempts among its last 10 tagged questions with ≥ 80 % correct** (grammar test or TOPIK questions).

## Decisions — TOPIK tests (EPIC 3)
- Exam format follows the **target level** (Settings): level 1–2 → TOPIK I reading (40 q / 60 min), 3–6 → TOPIK II reading (50 q / 70 min). Overridable per test.
- Only **text-based** question types now; graph/poster/ad items deferred to a later EPIC.
- Settings page per test: question types and count per type (**max 10 per type**), mode.
- **Help lookup = option A + local cache + fallback C**: passages are annotated at generation time (lemma, gloss, grammar ids per word); the whole word/grammar library is cached client-side so a tap is instant; if annotation is missing/wrong, an on-tap AI lookup (fast tier) is the fallback.
- **Blank mode:** tap any word → drawer (bottom sheet on mobile over the test, side panel on desktop) with translation and grammar info; add missing words (AI example sentence) or grammar (AI lesson, reviewed) from the drawer. Immediate answer feedback. **Looking up a word that exists in the bank resets it to level 0.**
- **Serious mode:** timer = official pace × number of questions (TOPIK I 90 s/q, TOPIK II 84 s/q), no lookups, results at the end.
- Every answer is stored; stats show success % per question type over time.
- Every MCQ is verified by an independent solver pass before being served.
- **Reuse:** only **failed** questions are reused (retry pool, ≤ 30 % of a new test); a question answered correctly is never served again.

## Decisions — Target level (EPIC 4)
- Target level chosen in Settings (already used by plan 04/05). The "align language content" feature is built last.
- Gap = deterministic comparison of the library against a **reference list** per level (imported CSV preferred — e.g. NIKL learner vocabulary list / international standard curriculum grammar; AI-generated reference list as fallback; no scraping).
- "Known" uses the definitions above.
- Each alignment run proposes **at most 30 words + 3 grammar lessons** (configurable), lowest level first, into a **review queue**; a new batch cannot be requested while the queue is not empty. Cost estimate shown and budget enforced before running.
