# Implementation plans

Execute in order. Each plan is self-contained and lists its dependencies, data model, tasks with acceptance criteria, tests and a Definition of Done.

| # | Plan | Depends on | Size |
|---|---|---|---|
| 00 | [Foundation](00-foundation.md) | — | M |
| 01 | [Words](01-words.md) | 00 | L |
| 02 | [Grammar](02-grammar.md) | 00 | M |
| 03 | [Grammar test + shared test engine](03-grammar-test.md) | 01, 02 | L |
| 04 | [TOPIK generation pipeline](04-topik-generation.md) | 03 | L |
| 05 | [TOPIK test modes, lookups, stats](05-topik-test-modes.md) | 04 | L |
| 06 | [Target level alignment](06-target-level.md) | 05 | M |

01 and 02 are independent of each other (both only need 00) and can be built in parallel branches.

## How to run a plan with Claude Code (local or cloud)
Prompt to use:
> Read CLAUDE.md, docs/VISION.md and docs/plans/NN-xxx.md. Implement the plan task by task without stopping for questions: follow the defaults in the plan, log any extra decision in docs/DECISIONS.md, put anything that needs me in docs/HUMAN_TODO.md. Commit after each task and tick its checkbox. Finish when the Definition of Done passes.

Recommended: one branch + PR per plan (`plan/01-words`).

## Conventions inside plans
- `[ ]` checkboxes are ticked by the implementer as tasks are done.
- "Default:" marks the choice to take when something is unclear.
- Schemas are given as field lists; exact Drizzle syntax is up to the implementer.
- AI prompts are described by intent + rules; write them in `lib/ai/prompts/<task>.ts` as exported functions so they can be tuned in one place.
