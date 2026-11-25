/*
 * `pnpm agents:eval [task] [--model <id>]` — runs langlearner-agents/evals/cases/<task>/*.json
 * against the real local Claude Code CLI (owner's login, plan 08 T8). Builds the real
 * prompts from lib/ai/prompts/*, calls the claude-code model directly (no DB, no budget,
 * no call cap), validates with the task's zod schema, checks `expect`, prints a table and
 * writes langlearner-agents/evals/last-run.local.json (gitignored). Not part of `pnpm test`.
 */
import fs from "node:fs";
import path from "node:path";
import { generateText, Output, type ModelMessage } from "ai";
import type { z } from "zod";
import { createClaudeCodeModel } from "@/lib/ai/claude-code/model";
import { checkExpect, countItems, parseEvalCase } from "@/lib/ai/claude-code/evals";
import { grammarRewritePrompt, grammarStructurePrompt } from "@/lib/ai/prompts/grammar";
import { photoExtractPrompt } from "@/lib/ai/prompts/words-photo-extract";
import { suggestTypesPrompt } from "@/lib/ai/prompts/words-suggest-types";
import { AI_TASKS, type AiTask } from "@/lib/ai/tasks";
import { env } from "@/lib/env";
import { grammarDraftSchema, structureOutputSchema } from "@/lib/grammar/schema";
import { photoExtractSchema } from "@/lib/words/photo";
import { suggestTypesSchema } from "@/lib/words/suggest-types";

type Built = { system: string; prompt: string; language: string };
type TaskSpec = { tier: "smart" | "fast"; schema: z.ZodType; build: (raw: unknown) => Built };

const TASKS: Record<AiTask, TaskSpec> = {
  "words.suggest_types": {
    tier: "fast",
    schema: suggestTypesSchema,
    build: (raw) => {
      const input = parseEvalCase("words.suggest_types", { input: raw, expect: {} }).input;
      return { ...suggestTypesPrompt(input.language, input.rows), language: input.language };
    },
  },
  "words.photo_extract": {
    tier: "smart",
    schema: photoExtractSchema,
    build: (raw) => {
      const input = parseEvalCase("words.photo_extract", { input: raw, expect: {} }).input;
      return { ...photoExtractPrompt(input.language), language: input.language };
    },
  },
  "grammar.structure": {
    tier: "smart",
    schema: structureOutputSchema,
    build: (raw) => {
      const input = parseEvalCase("grammar.structure", { input: raw, expect: {} }).input;
      const p = grammarStructurePrompt(
        input.ctx,
        input.lessons,
        input.notes === undefined ? { image: true } : { notes: input.notes },
      );
      return { ...p, language: input.ctx.language };
    },
  },
  "grammar.rewrite": {
    tier: "smart",
    schema: grammarDraftSchema,
    build: (raw) => {
      const input = parseEvalCase("grammar.rewrite", { input: raw, expect: {} }).input;
      const p = grammarRewritePrompt(input.ctx, JSON.stringify(input.draft), input.instruction);
      return { ...p, language: input.ctx.language };
    },
  },
};

const EVALS_DIR = path.join(env.CLAUDE_AGENTS_DIR, "evals");
const MEDIA: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

type Row = {
  task: string;
  case: string;
  ok: boolean;
  seconds: number;
  inputTokens: number;
  outputTokens: number;
  failures: string[];
  output?: unknown;
};

function parseArgs(argv: string[]): { task: AiTask | null; model: string | null } {
  let task: AiTask | null = null;
  let model: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--model") model = argv[++i] ?? null;
    else if ((AI_TASKS as readonly string[]).includes(argv[i])) task = argv[i] as AiTask;
    else throw new Error(`Unknown argument "${argv[i]}". Tasks: ${AI_TASKS.join(", ")}.`);
  }
  return { task, model };
}

function messagesFor(prompt: string, imagePath: string | undefined): ModelMessage[] {
  if (!imagePath) return [{ role: "user", content: prompt }];
  const file = path.join(EVALS_DIR, imagePath);
  const mediaType = MEDIA[path.extname(file).toLowerCase()];
  if (!mediaType) throw new Error(`Unsupported image type: ${imagePath}`);
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "file", data: new Uint8Array(fs.readFileSync(file)), mediaType },
      ],
    },
  ];
}

async function runCase(task: AiTask, file: string, modelOverride: string | null): Promise<Row> {
  const name = path.basename(file, ".json");
  const started = Date.now();
  const row: Row = {
    task,
    case: name,
    ok: false,
    seconds: 0,
    inputTokens: 0,
    outputTokens: 0,
    failures: [],
  };
  try {
    const c = parseEvalCase(task, JSON.parse(fs.readFileSync(file, "utf8")));
    const spec = TASKS[task];
    const built = spec.build(c.input);
    const modelId =
      modelOverride ?? (spec.tier === "smart" ? env.AI_MODEL_SMART : env.AI_MODEL_FAST);
    const result = await generateText({
      model: createClaudeCodeModel(modelId, task, built.language),
      instructions: built.system,
      messages: messagesFor(built.prompt, c.image),
      output: Output.object({ schema: spec.schema }),
    });
    row.output = result.output;
    row.inputTokens = result.usage.inputTokens ?? 0;
    row.outputTokens = result.usage.outputTokens ?? 0;
    row.failures = checkExpect(result.output, countItems(task, result.output), c.expect);
    row.ok = row.failures.length === 0;
  } catch (e) {
    row.failures = [e instanceof Error ? e.message : String(e)];
  }
  row.seconds = Math.round((Date.now() - started) / 100) / 10;
  return row;
}

async function main() {
  if (env.AI_MOCK) {
    console.error("agents:eval calls the real Claude Code CLI: unset AI_MOCK (AI_MOCK=1 is set).");
    process.exit(1);
  }
  const { task, model } = parseArgs(process.argv.slice(2));
  const tasks = task ? [task] : [...AI_TASKS];
  const rows: Row[] = [];
  for (const t of tasks) {
    const dir = path.join(EVALS_DIR, "cases", t);
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .sort()
      : [];
    if (files.length === 0) console.warn(`No eval cases for ${t} (${dir}).`);
    for (const f of files) {
      process.stdout.write(`${t} / ${f} … `);
      const row = await runCase(t, path.join(dir, f), model);
      console.log(row.ok ? "ok" : "FAIL");
      rows.push(row);
    }
  }

  console.table(
    rows.map((r) => ({
      task: r.task,
      case: r.case,
      ok: r.ok ? "✓" : "✗",
      seconds: r.seconds,
      tokens: `${r.inputTokens} in / ${r.outputTokens} out`,
    })),
  );
  for (const r of rows.filter((x) => !x.ok)) {
    console.log(`✗ ${r.task} / ${r.case}:\n  - ${r.failures.join("\n  - ")}`);
  }
  const out = path.join(EVALS_DIR, "last-run.local.json");
  fs.writeFileSync(
    out,
    JSON.stringify({ at: new Date().toISOString(), model, rows }, null, 2) + "\n",
    "utf8",
  );
  const passed = rows.filter((r) => r.ok).length;
  console.log(
    `\n${passed}/${rows.length} cases passed. Details: ${path.relative(process.cwd(), out)}`,
  );
  process.exit(passed === rows.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
