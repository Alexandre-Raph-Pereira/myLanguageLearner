# Plan 08 — `langlearner-agents/` (the tutor's brain)

**Goal:** a folder at the repo root, `langlearner-agents/`, that is the working directory of the local Claude Code process the app calls (plan 07). It holds **how the tutor teaches**: role, learner profile, one skill per AI task, personas, and evals. The owner can change teaching style by editing Markdown files, without touching app code.

**Depends on:** 02 (the four existing AI tasks). Works with or without plan 07 done: this plan builds the folder, its manifest loader and its checks; plan 07's adapter uses them. If plan 07 is already done, T4 also wires the loader into the adapter.

**Separate task:** implement this plan in its own session/branch, apart from plan 07.

---

## Principles (log in `docs/DECISIONS.md` in T1)

- **Two layers, no duplication.**
  - `lib/ai/prompts/*` (code) = the **contract**: task rules, data given to the model, output fields. Used by every provider (API or Claude Code). Unchanged by this plan.
  - `langlearner-agents/` = **pedagogy and style**: who the learner is, how to explain, tone, Korean-specific teaching rules, task-specific quality guidance. Used only by the `claude-code` provider.
  - A skill may add guidance but **must never change the output format** (the app's zod schemas decide; plan 07 still validates and retries).
- **Deterministic, single-turn calls.** At runtime Claude Code has **no tools** (no Bash, files, web, MCP). The adapter reads the task's skill and persona from the folder and **injects them into the appended system prompt** (default `CLAUDE_AGENTS_SKILL_MODE=inline`). The files still use the Claude Code skill / agent formats, so the owner can also open the folder in Claude Code and use them interactively. Optional mode `tool` (allow only the `Skill` tool and let Claude load skills itself) is kept for experiments, not default: it adds a round trip.
- **The app gives the data.** The model never reads the database. Learner data a task needs (word list, lessons, mistakes) is put in the prompt by the app, scoped by `userId` as always.
- **Public repo:** personal data never committed. The learner profile lives in `learner/profile.local.md` (gitignored); `learner/profile.example.md` is committed.

---

## Folder layout

```
langlearner-agents/
  README.md                     what this folder is, how it is used, how to edit / add a task
  CLAUDE.md                     runtime role: "you are the tutor engine of myLanguageLearner" + global rules
  manifest.json                 task → skill + persona (+ optional notes), read by the adapter
  learner/
    profile.example.md          template (committed)
    profile.local.md            owner's real profile (gitignored; created from the example)
  .claude/
    settings.json               deny every tool, no MCP servers, no hooks
    skills/
      korean-teaching/SKILL.md      shared: how to teach Korean (register, honorifics, particles, conjugation explanations, romanization policy = none unless asked, NFC)
      words-suggest-types/SKILL.md
      words-photo-extract/SKILL.md
      grammar-structure/SKILL.md
      grammar-rewrite/SKILL.md
    agents/
      tutor.md                  warm, clear, concise explainer (lessons, feedback)
      examiner.md               strict, exam-accurate (TOPIK-style generation and grading, plans 03–06)
      extractor.md              literal, no creativity (OCR / extraction / classification)
  evals/
    cases/<task>/<name>.json    input given to the task + expectations
```

### `manifest.json` (contract with plan 07's adapter)
```json
{
  "version": 1,
  "shared": ["korean-teaching"],
  "tasks": {
    "words.suggest_types":  { "skill": "words-suggest-types",  "agent": "extractor" },
    "words.photo_extract":  { "skill": "words-photo-extract",  "agent": "extractor" },
    "grammar.structure":    { "skill": "grammar-structure",    "agent": "tutor" },
    "grammar.rewrite":      { "skill": "grammar-rewrite",      "agent": "tutor" }
  }
}
```
- `shared` skills apply to every task of a language-teaching kind (default: all tasks; a task may set `"shared": false`).
- A task missing from the manifest still works (only `CLAUDE.md` applies) and logs a warning once.
- Shared skills that are language-specific are picked by the call's language later (`korean-teaching` for `ko`); default now: only `ko` exists, name the key so French/English can be added (`"shared": { "ko": ["korean-teaching"] }` is acceptable if simpler — decide in T3 and log it).

### Appended system prompt built by the adapter (inline mode)
```
--system-prompt-file =            (plan 07 replaces Claude Code's default prompt; see DECISIONS)
  [CLAUDE.md of the folder — read by the app, Claude Code's auto-discovery is not relied on]
  [persona body from .claude/agents/<agent>.md]
  [learner profile: learner/profile.local.md, or profile.example.md if missing]
  [shared skill bodies]
  [task skill body]
  [task system prompt from lib/ai/prompts/* — always last, it wins on format]
```
Frontmatter is stripped; bodies are joined with `---` separators. Total appended size capped (default 24 kB) with a clear error if exceeded.

---

## Tasks

### [x] T1 — Skeleton & decisions
- Create the folder, `README.md`, `.claude/settings.json` (deny all tools; verify the settings keys against the installed Claude Code docs), `learner/profile.example.md`.
- `.gitignore`: `langlearner-agents/learner/*.local.md`.
- If plan 07's T2 stub exists, replace it.
- Append the principles above to `docs/DECISIONS.md`.

### [x] T2 — `CLAUDE.md` and learner profile
- `CLAUDE.md` (≤ 80 lines): role (tutor engine called by an app, not a chat), always answer in the requested format only, no greetings/meta, target language in Unicode NFC, explanations in the learner's native language (given in each request), prefer natural everyday examples, be concise, never invent learner data not given in the request, keep exam level in mind.
- `profile.example.md` sections: native language, other languages known, current level (TOPIK estimate), target level + date, how I learn best, known weak points, topics I like (for examples), things to avoid. Keep placeholders, no real data.

### [x] T3 — Manifest + loader (`lib/ai/claude-code/agents.ts`, `server-only`)
- zod schema for `manifest.json`; `loadAgentsContext(task, language)` → `{ appendedPrompt: string, warnings: string[] }` built as described above; reads files once and caches them by mtime (edits apply without restarting the server).
- Pure part (`buildAppendedPrompt(parts)`, frontmatter stripping, size cap) separated and unit-tested.
- **Accept:** unit tests on a temp folder: full task, task missing from manifest, missing profile.local → example used, oversize → error.

### [ ] T4 — Wire into the adapter (only if plan 07 is done; otherwise add to HUMAN_TODO / plan 07 notes)
- `loadAgentsInstructions(dir, task)` in `lib/ai/claude-code/agents.ts` (plan 07, today returns `CLAUDE.md` only) becomes `loadAgentsContext`; its result goes before the task system prompt in the `--system-prompt-file` (pass the call's language through `createClaudeCodeModel` if a language-specific shared skill is needed).
- `CLAUDE_AGENTS_SKILL_MODE` env: `inline` (default) | `tool` (allow only `Skill`, don't inline the task skill; inline persona + profile still).
- **Accept:** fake-CLI test asserts the appended prompt contains persona, profile, shared skill, task skill and the task prompt last.

### [ ] T5 — Skills for the existing tasks
Each `SKILL.md` has Claude Code frontmatter (`name`, `description` saying which app task it serves) and a body of **guidance only** (no output format; refer to "the fields requested by the app"):
- `korean-teaching`: speech levels (해요체 default for examples, when to show 합쇼체/반말), particle explanations, irregular conjugations (ㅂ, ㄷ, ㅅ, 르, ㅎ, ㄹ), spacing (띄어쓰기) rules to respect in examples, no romanization unless asked, typical mistakes of English/French speakers, NFC.
- `words-suggest-types`: how to decide noun / verb / adjective / adverb / expression…; 하다 verbs vs nouns; when to say `other`.
- `words-photo-extract`: read handwriting literally, never "fix" a word into another word, lower confidence when unsure, keep the learner's meaning text, ignore crossed-out text.
- `grammar-structure`: keep the learner's own notes and examples first, complete missing parts, examples of the right level, contrast with confusable patterns, one lesson per grammar point.
- `grammar-rewrite`: follow the learner's instruction literally, change only what was asked, keep examples that are correct.
- Fixtures/mocks are unchanged (mock mode never reads this folder).

### [ ] T6 — Personas (`.claude/agents/*.md`)
- `tutor`, `examiner`, `extractor` with Claude Code subagent frontmatter (`name`, `description`, `tools: []` or the equivalent "no tools") and a short body (tone, strictness, what to optimise for).

### [ ] T7 — Consistency test (runs in `pnpm test`, no Claude needed)
`tests/agents-folder.test.ts`:
- manifest validates; every task referenced exists as a skill and persona file with valid frontmatter;
- **every AI task used in code** (collect `task: "…"` from `lib/**` calls, or a central `AI_TASKS` list if one exists — create it if not) has a manifest entry → adding a task in plans 03–06 without a skill fails the test;
- no file in the folder contains a `.local.md` profile or anything matching key patterns (`sk-ant-`, `ANTHROPIC_API_KEY=`).

### [ ] T8 — Evals (manual, real Claude Code, owner's machine)
- `evals/cases/<task>/*.json`: `{ "input": <args for the task's prompt builder>, "image"?: "<path to a sample image under evals/images>", "expect": { "minDrafts"?: n, "mustContain"?: ["…"], "mustNotContain"?: ["…"] } }`. Start with 2–3 cases per existing task (sample notebook photos: synthetic/printed, nothing personal).
- `scripts/agents-eval.ts` + `pnpm agents:eval [task]`: builds the real prompts with `lib/ai/prompts/*`, calls the `claude-code` model directly (no DB, no budget), validates with the task's zod schema, checks `expect`, prints a table (task, case, ok, seconds, tokens) and writes `langlearner-agents/evals/last-run.local.json` (gitignored). Refuses to run with `AI_MOCK=1`.
- Not part of `pnpm test` (needs the owner's login).

### [ ] T9 — Docs
- `langlearner-agents/README.md`: what each file does, how to edit the profile, how to tune a skill and re-run `pnpm agents:eval <task>`, how to add a task.
- `docs/plans/README.md` conventions: "A new AI task adds a prompt in `lib/ai/prompts/`, a fixture in `tests/fixtures/ai/`, **and** a manifest entry + skill in `langlearner-agents/`".
- `CLAUDE.md` (repo): add `langlearner-agents/` to Layout and the rule above to "AI mock mode / new AI task".
- `docs/HUMAN_TODO.md` Plan 08 section: copy `profile.example.md` to `profile.local.md` and fill it; run `pnpm agents:eval` once on the home server and read the results; tweak skills to taste.

---

## Out of scope
- Letting the runtime model use tools or read the database.
- Auto-generating the learner profile from app data (possible later: a task that summarises mistakes into the profile).
- Skills for plans 03–06 tasks: each of those plans adds its own when it creates the task (enforced by T7).

## Definition of Done
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass (T7 included).
- Folder complete with manifest, `CLAUDE.md`, profile example, 5 skills, 3 personas, evals for the 4 existing tasks.
- If plan 07 is done: fake-CLI test shows the full appended prompt; owner's `pnpm agents:eval` run listed in HUMAN_TODO.
- DECISIONS, README files, repo `CLAUDE.md` and plans README updated.
