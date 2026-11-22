# Plan 04 — TOPIK reading test generation (EPIC 3, part 1)

**Goal:** generate verified, annotated TOPIK reading items (TOPIK I or II depending on the target level) from the learner's words and grammar, using the shared test engine of plan 03. No UI for taking the test yet except a dev preview (plan 05 builds the runner).

**Depends on:** 03.

---

## 1. Exam catalog (`lib/exams/topik/catalog.ts`)

Each entry: `{ id, exam: 'TOPIK_I'|'TOPIK_II', items: string /* official item numbers */, instruction_ko, subPrompts_ko[] /* one per question in the group */, questionsPerGroup, passageSpec /* genre, length in characters, markers */, optionsSpec, difficulty: 'low'|'mid'|'high', deferred: boolean }`.

Instruction lines must be copied exactly in Korean as below. The table is drafted from the official paper format; if web access is available, spot-check against one recent official paper (topik.go.kr publishes past papers) and fix item numbers/wording, logging changes in DECISIONS.md. If not, use as is.

### TOPIK I — 읽기 (questions 31–70, 40 q, 60 min)
| id | items | instruction / sub-prompts | q/group | passage | deferred |
|---|---|---|---|---|---|
| `t1.topic_word` | 31–33 | 무엇에 대한 이야기입니까? 알맞은 것을 고르십시오. | 1 | 2 very short sentences; options = 4 topic nouns (날씨, 가족, 나이…) | no |
| `t1.blank` | 34–39 | ( )에 들어갈 가장 알맞은 것을 고르십시오. | 1 | 2 short sentences, blank = particle / noun / verb / adjective / adverb | no |
| `t1.notice_not_match` | 40–42 | 다음을 읽고 맞지 않는 것을 고르십시오. | 1 | notice/ad/message card (visual) | **yes** |
| `t1.content_match` | 43–45 | 다음의 내용과 같은 것을 고르십시오. | 1 | 3–4 sentences | no |
| `t1.main_idea` | 46–48 | 다음을 읽고 중심 생각을 고르십시오. | 1 | 3–4 sentences, first person | no |
| `t1.pair_blank_content` | 49–50, 53–56, 61–62, 65–66 | 다음을 읽고 물음에 답하십시오. → ㉠에 들어갈 알맞은 말을 고르십시오. / 이 글의 내용과 같은 것을 고르십시오. | 2 | 5–7 sentences with ( ㉠ ) | no |
| `t1.pair_blank_topic` | 51–52 | 다음을 읽고 물음에 답하십시오. → ㉠에 들어갈 알맞은 말을 고르십시오. / 무엇에 대한 이야기인지 맞는 것을 고르십시오. | 2 | informational text | no |
| `t1.ordering` | 57–58 | 다음을 순서대로 맞게 나열한 것을 고르십시오. | 1 | 4 sentences (가)(나)(다)(라); options = sequences | no |
| `t1.pair_insertion_content` | 59–60 | 다음을 읽고 물음에 답하십시오. → 다음 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오. / 이 글의 내용과 같은 것을 고르십시오. | 2 | text with ( ㉠ )…( ㉣ ) + given sentence | no |
| `t1.pair_purpose_content` | 63–64 | 다음을 읽고 물음에 답하십시오. → 왜 윗글을 썼는지 맞는 것을 고르십시오. / 이 글의 내용과 같은 것을 고르십시오. | 2 | email / announcement as plain text | no |
| `t1.pair_blank_inference` | 67–70 | 다음을 읽고 물음에 답하십시오. → ㉠에 들어갈 내용으로 가장 알맞은 것을 고르십시오. / 이 글의 내용으로 알 수 있는 것을 고르십시오. | 2 | longest TOPIK I passages | no |

### TOPIK II — 읽기 (questions 1–50, 50 q, 70 min)
| id | items | instruction / sub-prompts | q/group | passage | deferred |
|---|---|---|---|---|---|
| `t2.grammar_blank` | 1–2 | ( )에 들어갈 가장 알맞은 것을 고르십시오. | 1 | 1 sentence, options = grammar forms | no |
| `t2.similar_expression` | 3–4 | 다음 밑줄 친 부분과 의미가 비슷한 것을 고르십시오. | 1 | 1 sentence, underlined grammar | no |
| `t2.what_about` | 5–8 | 다음은 무엇에 대한 글인지 고르십시오. | 1 | ad/poster copy (visual) | **yes** |
| `t2.notice_graph_match` | 9–10 | 다음 글 또는 그래프의 내용과 같은 것을 고르십시오. | 1 | notice / graph (visual) | **yes** |
| `t2.content_match_short` | 11–12 | 다음 글의 내용과 같은 것을 고르십시오. | 1 | short news-style paragraph | no |
| `t2.ordering` | 13–15 | 다음을 순서대로 맞게 배열한 것을 고르십시오. | 1 | (가)(나)(다)(라) | no |
| `t2.passage_blank` | 16–18 | 다음을 읽고 ( )에 들어갈 내용으로 가장 알맞은 것을 고르십시오. | 1 | explanatory paragraph | no |
| `t2.pair_connective_content` | 19–20 | 다음을 읽고 물음에 답하십시오. → ( )에 들어갈 알맞은 것을 고르십시오. / 위 글의 내용과 같은 것을 고르십시오. | 2 | blank = adverb/connective | no |
| `t2.pair_idiom_mainidea` | 21–22 | … → ( )에 들어갈 알맞은 것을 고르십시오. / 위 글의 중심 생각을 고르십시오. | 2 | blank = idiom/proverb | no |
| `t2.pair_feeling_content` | 23–24 | … → 밑줄 친 부분에 나타난 '나'의 심정으로 알맞은 것을 고르십시오. / 위 글의 내용과 같은 것을 고르십시오. | 2 | personal essay, underlined phrase | no |
| `t2.headline` | 25–27 | 다음은 신문 기사의 제목입니다. 가장 잘 설명한 것을 고르십시오. | 1 | one headline | no |
| `t2.passage_blank_hard` | 28–31 | 다음을 읽고 ( )에 들어갈 내용으로 가장 알맞은 것을 고르십시오. | 1 | academic paragraph | no |
| `t2.content_match_long` | 32–34 | 다음을 읽고 내용이 같은 것을 고르십시오. | 1 | informational paragraph | no |
| `t2.main_topic` | 35–38 | 다음 글의 주제로 가장 알맞은 것을 고르십시오. | 1 | argumentative paragraph | no |
| `t2.sentence_insertion` | 39–41 | 주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오. | 1 | paragraph with ( ㉠ )…( ㉣ ) + given sentence | no |
| `t2.pair_literary` | 42–43 | … → 밑줄 친 부분에 나타난 인물의 심정으로 알맞은 것을 고르십시오. / 위 글의 내용으로 알 수 있는 것을 고르십시오. | 2 | novel excerpt | no |
| `t2.pair_blank_topic` | 44–45 | … → 위 글의 주제로 알맞은 것을 고르십시오. / ( )에 들어갈 내용으로 알맞은 것을 고르십시오. | 2 | | no |
| `t2.pair_attitude_content` | 46–47 | … → 위 글에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오. / 위 글의 내용과 같은 것을 고르십시오. | 2 | opinion piece | no |
| `t2.triple_purpose` | 48–50 | … → 필자가 이 글을 쓴 목적으로 알맞은 것을 고르십시오. / ( )에 들어갈 내용으로 알맞은 것을 고르십시오. / 밑줄 친 부분에 나타난 필자의 태도로 알맞은 것을 고르십시오. | 3 | long editorial | no |

Deferred types stay in the catalog (for the future EPIC) but are hidden from the config page.

### Level → exam & difficulty (`lib/exams/topik/level.ts`)
- target level 1–2 → `TOPIK_I`; 3–6 → `TOPIK_II`; null → ask in config page (default TOPIK I).
- Difficulty guidance given to the prompt: level 1 / 2 / 3 / 4 / 5 / 6 with short descriptors (sentence length, register, vocabulary breadth, abstract topics from level 5).
- Serious-mode pace: TOPIK I `3600/40 = 90 s` per question, TOPIK II `4200/50 = 84 s`.
- Preset "Full section (text-only)": the official count per type, excluding deferred types.

---

## 2. Data model (`db/schema/topik.ts`)

`topik_passages`
- `id`, `user_id`, `language`, `exam`, `catalog_id`, `level`
- `content` text (Korean, NFC; markers `( ㉠ )`, `(가)`, `<u>…</u>` for underline are part of the text)
- `given_sentence` text null (insertion types)
- `annotations` jsonb `{ [textKey]: Token[] | null }` — `textKey` = `passage`, `given`, `q{i}.stem`, `q{i}.opt{k}`
- `annotation_status` text `pending | done | partial | failed`
- `coverage` real null (share of content-word lemmas found in the library)
- `created_at`

Add FK `questions.passage_id → topik_passages.id`.

`Token` (zod, short keys to save output tokens):
```
{ s: string            // eojeol surface as it appears (space-separated unit, punctuation attached)
  l: { lemma, pos, gloss }[]   // content morphemes (dictionary form, word_type, English gloss)
  g: { code: string|null, pattern, meaning }[]  // grammar pieces; code = library code (G12) or null if not in library
}
```
Server post-processing adds `wordIds` (per lemma) and `grammarId` (per code) → stored resolved.

Question payload `topik.mcq` (registered in the plan 03 registry, one schema for all TOPIK MCQ types):
`{ catalog_id, sub_prompt_ko, stem_ko? /* e.g. headline or sentence with underline when not in passage */, options[4], answerIndex }` + `explanation_md`, `grammar_ids`.

---

## 3. Pipeline per group (`lib/exams/topik/pipeline.ts`)
Runs inside `POST /api/tests/[sessionId]/generate/[groupIndex]` (`maxDuration` 120) using the plan 03 engine, one shared budget operation.

1. **Generate** — task `topik.generate`, tier smart, `cacheSystem: true`. System prefix (cached, stable across groups): role, TOPIK rules, catalog entry list, compact grammar list `G1: -아/어서 — because / and then` (all active lessons), up to 300 known words (level ≥ 2). User part: catalog entry, level descriptor, count, topic seed (random from a list of ~60 everyday/social topics, avoiding topics used in the user's last 20 passages).
   Rules: natural, exam-style Korean at the level; correct register (-ㅂ니다/-다 styles as in the real exam); exactly one correct answer; 4 options of similar length and form; distractors plausible but clearly wrong given the text; no answer leakage in stems; prefer the learner's known words and grammar, at most ~10 % vocabulary outside the library at the target level; tag `grammar_codes` used; explanation in English per question (why right, why each distractor wrong in one line).
   Output: `{ passage: { content, given_sentence? }, questions: [{ sub_prompt_ko, stem_ko?, options, answerIndex, explanation_md, grammar_codes }] }`.
2. **Verify** — `verifyMcq` (plan 03) per question with the passage as context. Mismatch → regenerate the whole group once → still mismatched question is dropped (if a pair loses one question, keep the other only if it is self-contained; default: drop the group).
3. **Annotate** — task `topik.annotate`, tier fast. Input: every text of the group (passage, given sentence, stems, options) as `{ key, text }`, plus the compact grammar list (cached). Output `{ texts: [{ key, tokens: Token[] }] }`.
   Rules: one token per whitespace-separated eojeol, in order, `s` identical to the text; lemmas in dictionary form (verbs/adjectives with 다); `pos` from the app's word_type list; grammar pieces include endings and particles worth explaining (skip trivial ones like 은/는/이/가/을/를 unless they are the point of a question), use a library code when the piece matches a lesson, else `code: null` with the pattern written like a lesson title.
4. **Post-process** (`lib/exams/topik/annotations.ts`, pure):
   - For each text: split the stored text on whitespace; require `tokens.length` and each `normKo(s)` to match; else mark that key `null` (plan 05 falls back to on-tap lookup) and set `annotation_status = partial`.
   - Resolve codes → grammar ids (unknown code → null); resolve lemmas → word ids by `normKo(lemma) == normKo(term)` within active words (multiple homonyms → keep all).
   - Compute `coverage`.
   - Questions' `grammar_ids` = resolved codes from generation ∪ grammar ids found in the passage tokens that appear in its own stem/options.
5. Insert passage + questions + session_items (`group_key` = groupIndex).

### Session creation (`lib/exams/topik/plan.ts`, pure)
Input: exam, counts per catalog id (each 0–10 questions, UI enforces), mode.
- Retry items first: `pickRetryQuestions` with filter = selected catalog ids & exam; bring the passage along; only the pending question(s) of a pair are served. Cap 30 % of total.
- Remaining questions → groups: for paired types, `ceil(remaining / questionsPerGroup)` groups (if a count is odd for a pair, last group serves only its first question). Order groups as in the official paper (by item numbers).
- Cost estimate: per-type token heuristics (generate ≈ 1.2k out for single, 2k pair, 3k triple; annotate ≈ 2× passage chars; verify small) → shown on the config page and checked against budgets before creating the session.

---

## Design note
No learner-facing UI in this plan. The dev preview (T7) uses the design tokens and `<T lang>` for Korean text; nothing else to design.

## 4. Tasks

### [ ] T1 — Catalog + level helpers
Catalog file, zod validation of entries, helpers (`visibleTypes(exam)`, `fullSectionPreset(exam)`, `paceSeconds(exam)`).
**Accept:** tests: no duplicate ids, instruction lines non-empty Korean, full preset counts sum to 40 / 50 minus deferred.

### [ ] T2 — Schema + payload type registration
`topik_passages`, FK, `topik.mcq` registered with deterministic grading.

### [ ] T3 — Session planner
`plan.ts` + tests (odd counts in pairs, retry cap, ordering, estimate).

### [ ] T4 — Prompts + generate/verify
`lib/ai/prompts/topik.ts`, fixtures `topik.generate.json` (one fixture per group shape: single, pair, triple), `topik.verify.json`.

### [ ] T5 — Annotation + post-processing
Prompt, fixtures `topik.annotate.json` (include one deliberately misaligned text), `annotations.ts` with thorough tests (alignment failure → null, code resolution, homonyms, coverage).

### [ ] T6 — Generate route integration
Wire into `/api/tests/[sessionId]/generate/[groupIndex]` (dispatch by `session.kind`). Budget errors mark the group failed with reason.

### [ ] T7 — Dev preview `/dev/topik` (only when `NODE_ENV !== 'production'` or setting `devTools = true`)
Pick catalog id + level → runs one group → renders passage, questions, answer, explanation and the raw JSON + annotations + cost. Used by the owner to tune prompts.

## Definition of Done
With mocks: a session for TOPIK II with 3 types generates all groups, each passage annotated (or partially, with fallback flags), questions verified, stored, retry questions included when pending. With a real key: owner can generate items in `/dev/topik` and read them. lint/typecheck/test/build green.
