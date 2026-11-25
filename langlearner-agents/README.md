# langlearner-agents

The tutor's brain. This folder is the working directory of the local Claude Code process
that answers the app's AI requests when `AI_PROVIDER=claude-code` (plan 07). It holds
**how the tutor teaches** — role, learner profile, one skill per AI task, personas and
evals — so you can change the teaching style by editing Markdown, without touching code.

## How it is used

For every AI call the app (`lib/ai/claude-code/agents.ts`) builds one system prompt:

```
CLAUDE.md                          role + global rules
.claude/agents/<persona>.md        tone / strictness for this task
learner/profile.local.md           you (falls back to profile.example.md)
.claude/skills/<shared>/SKILL.md   e.g. korean-teaching, picked by the call's language
.claude/skills/<task>/SKILL.md     guidance for this task
— task prompt from lib/ai/prompts/* (always last: it defines the output format)
```

Frontmatter is stripped, parts are joined with `---`, and the agents part is capped at
24 kB (a clear error names the biggest files). Files are re-read when they change: no
restart needed. At runtime Claude Code has **no tools** and never reads your data; the
app puts what a task needs in the request.

Two layers, no duplication: `lib/ai/prompts/*` is the **contract** (rules, data, output
fields, used by every provider); this folder is **pedagogy and style** (only the
`claude-code` provider). A skill may add guidance but must never change the output
format — the app validates every answer with zod.

## Files

| File | What it does |
|---|---|
| `CLAUDE.md` | Runtime role: tutor engine called by an app; answer format, NFC, native language, no invented data. |
| `manifest.json` | Task → skill + persona; shared skills per language (`"shared": { "ko": [...] }`); a task can set `"shared": false`. A task missing here gets `CLAUDE.md` only (warned once). |
| `learner/profile.example.md` | Profile template (committed, placeholders only). |
| `learner/profile.local.md` | **Your** profile (gitignored). |
| `.claude/settings.json` | Denies every tool, no hooks, no MCP servers (defence in depth; the app also passes `--tools ""`). |
| `.claude/skills/korean-teaching/` | Shared Korean teaching rules (speech levels, particles, irregulars, spacing, no romanization). |
| `.claude/skills/<task>/` | One skill per AI task (`words-suggest-types`, `words-photo-extract`, `grammar-structure`, `grammar-rewrite`). |
| `.claude/agents/` | Personas: `tutor` (warm, clear), `examiner` (strict, exam-accurate), `extractor` (literal). |
| `evals/cases/<task>/*.json` | Eval cases: input for the task's prompt builder, optional `image` (under `evals/images/`), `expect`. |
| `evals/last-run.local.json` | Results of the last `pnpm agents:eval` (gitignored). |

## Edit your profile

```bash
cp langlearner-agents/learner/profile.example.md langlearner-agents/learner/profile.local.md
```

Fill every section (native language, level, target, how you learn, weak points, topics
you like, things to avoid). Keep it short; it is sent with every request.

## Tune a skill

1. Edit `.claude/skills/<skill>/SKILL.md` (guidance only — never describe output fields).
2. Re-run its evals on the home server (real Claude Code, your plan's usage):
   ```bash
   pnpm agents:eval grammar.structure
   ```
   `pnpm agents:eval` alone runs every task; `--model <id>` overrides the model.
3. Read the table and `evals/last-run.local.json`; add a case when you find a new
   failure (`expect`: `minDrafts`, `maxDrafts`, `mustContain`, `mustNotContain`).

`CLAUDE_AGENTS_SKILL_MODE=tool` (experiment) lets Claude load the task skill itself with
the Skill tool instead of inlining it; `inline` (default) is faster and deterministic.

## Add a task

A new AI task adds, in the same change:
1. a prompt in `lib/ai/prompts/` and the task name in `lib/ai/tasks.ts` (`AI_TASKS`);
2. a mock fixture `tests/fixtures/ai/<task>.json`;
3. a manifest entry + `.claude/skills/<skill>/SKILL.md` (frontmatter `name`, a
   `description` naming the task), and a persona if none fits;
4. an input schema in `lib/ai/claude-code/evals.ts`, a runner entry in
   `scripts/agents-eval.ts`, and at least 2 eval cases.

`tests/agents-folder.test.ts` (part of `pnpm test`) fails when one of these is missing.

You can also open this folder in Claude Code interactively: the skills and personas use
the standard Claude Code formats.
