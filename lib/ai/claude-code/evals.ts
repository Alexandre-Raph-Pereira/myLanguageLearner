/**
 * Eval cases of `langlearner-agents/evals/cases/<task>/<name>.json` (plan 08 T8):
 * format, per-task input schemas and the expectation check. Pure, no I/O.
 * Run with `pnpm agents:eval [task]` (scripts/agents-eval.ts, real Claude Code).
 */
import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import type { AiTask } from "@/lib/ai/tasks";

const language = z.enum(SUPPORTED_LANGUAGES);

const grammarCtx = z.object({
  language,
  nativeLanguage: z.string().min(1),
  targetLevel: z.number().int().min(1).max(6).nullable(),
});

/** Arguments of each task's prompt builder in `lib/ai/prompts/*`. */
export const evalInputSchemas = {
  "words.suggest_types": z.object({
    language,
    rows: z.array(z.object({ i: z.number().int(), term: z.string(), meaning: z.string() })).min(1),
  }),
  "words.photo_extract": z.object({ language }),
  "grammar.structure": z.object({
    ctx: grammarCtx,
    lessons: z.array(z.object({ code: z.string(), title: z.string(), meaningShort: z.string() })),
    notes: z.string().optional(),
  }),
  "grammar.rewrite": z.object({
    ctx: grammarCtx,
    /** The draft as `draftForRewrite` sends it (any JSON object). */
    draft: z.record(z.string(), z.unknown()),
    instruction: z.string().nullable(),
  }),
} satisfies Record<AiTask, z.ZodType>;

export const evalExpectSchema = z.object({
  /** Minimum number of items (drafts, entries, types) in the answer. */
  minDrafts: z.number().int().min(0).optional(),
  /** Maximum number of items (e.g. a crossed-out word must not be extracted). */
  maxDrafts: z.number().int().min(0).optional(),
  /** Strings that must appear in the answer JSON (NFC compared). */
  mustContain: z.array(z.string()).optional(),
  /** Strings that must not appear in the answer JSON. */
  mustNotContain: z.array(z.string()).optional(),
});

export const evalCaseSchema = z.object({
  description: z.string().optional(),
  input: z.unknown(),
  /** Image path relative to `langlearner-agents/evals/` (e.g. `images/page.jpg`). */
  image: z.string().optional(),
  expect: evalExpectSchema,
});

export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalExpect = z.infer<typeof evalExpectSchema>;

/** Validates a case file's JSON for a task; returns the parsed case and its typed input. */
export function parseEvalCase<T extends AiTask>(task: T, json: unknown) {
  const c = evalCaseSchema.parse(json);
  const input = evalInputSchemas[task].parse(c.input) as z.infer<(typeof evalInputSchemas)[T]>;
  return { ...c, input };
}

/** The items counted by `minDrafts` / `maxDrafts` for each task's output. */
export function countItems(task: AiTask, output: unknown): number {
  const o = output as Record<string, unknown[] | undefined>;
  switch (task) {
    case "words.suggest_types":
      return o.types?.length ?? 0;
    case "words.photo_extract":
      return o.entries?.length ?? 0;
    case "grammar.structure":
      return o.drafts?.length ?? 0;
    case "grammar.rewrite":
      return output ? 1 : 0;
  }
}

/** Failed expectations (empty = ok). */
export function checkExpect(output: unknown, count: number, expect: EvalExpect): string[] {
  const text = JSON.stringify(output).normalize("NFC");
  const failures: string[] = [];
  if (expect.minDrafts !== undefined && count < expect.minDrafts) {
    failures.push(`expected at least ${expect.minDrafts} items, got ${count}`);
  }
  if (expect.maxDrafts !== undefined && count > expect.maxDrafts) {
    failures.push(`expected at most ${expect.maxDrafts} items, got ${count}`);
  }
  for (const s of expect.mustContain ?? []) {
    if (!text.includes(s.normalize("NFC"))) failures.push(`missing "${s}"`);
  }
  for (const s of expect.mustNotContain ?? []) {
    if (text.includes(s.normalize("NFC"))) failures.push(`must not contain "${s}"`);
  }
  return failures;
}
