/**
 * Every AI task the app calls (`task` of `aiObject` / `aiText`). Each one needs a prompt in
 * `lib/ai/prompts/`, a mock fixture in `tests/fixtures/ai/<task>.json` and an entry +
 * skill in `langlearner-agents/manifest.json` (checked by `tests/agents-folder.test.ts`).
 */
export const AI_TASKS = [
  "words.suggest_types",
  "words.photo_extract",
  "grammar.structure",
  "grammar.rewrite",
] as const;

export type AiTask = (typeof AI_TASKS)[number];
