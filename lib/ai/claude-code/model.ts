import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env";
import { AiError } from "../errors";
import { agentsDirExists, loadAgentsContext } from "./agents";
import {
  buildCliArgs,
  buildSystemPrompt,
  childEnv,
  promptToCliInput,
  stdinLine,
  type CallOptions,
} from "./args";
import { explainCliFailure, parseCliOutput } from "./parse";
import { Semaphore } from "./semaphore";

type ModelV4 = Extract<Exclude<LanguageModel, string>, { specificationVersion: "v4" }>;
type GenerateResult = Awaited<ReturnType<ModelV4["doGenerate"]>>;

let semaphore: Semaphore | null = null;
function slots(): Semaphore {
  const limit = env.CLAUDE_CODE_MAX_CONCURRENT;
  if (!semaphore || semaphore.limit !== limit) semaphore = new Semaphore(limit);
  return semaphore;
}

type RunOutput = { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean };

function runCli(opts: {
  bin: string;
  args: string[];
  stdin: string;
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<RunOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(opts.bin, opts.args, {
      cwd: opts.cwd,
      env: childEnv(process.env),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const kill = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, opts.timeoutMs);
    const onAbort = () => kill();
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      if (stderr.length < 20_000) stderr += d;
    });
    child.on("error", (e) => done(() => reject(e)));
    child.on("close", (exitCode) => done(() => resolve({ stdout, stderr, exitCode, timedOut })));
    child.stdin.on("error", () => {
      // the process may exit before reading stdin; the close handler reports it
    });
    child.stdin.end(opts.stdin);
  });
}

async function generate(
  modelId: string,
  task: string,
  options: CallOptions,
): Promise<GenerateResult> {
  const cwd = env.CLAUDE_AGENTS_DIR;
  if (!agentsDirExists(cwd)) {
    throw new AiError(
      `Claude Code agents folder not found (${path.basename(cwd)}). Check CLAUDE_AGENTS_DIR.`,
    );
  }
  const input = promptToCliInput(options.prompt);
  const system = buildSystemPrompt(loadAgentsContext(cwd, task, "ko").appendedPrompt, input.system);
  const jsonSchema =
    options.responseFormat?.type === "json" ? (options.responseFormat.schema ?? {}) : undefined;

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mll-claude-"));
  const systemPromptFile = path.join(tmp, "system.md");
  await fs.writeFile(systemPromptFile, system, "utf8");

  const release = await slots().acquire();
  let out: RunOutput;
  try {
    out = await runCli({
      bin: env.CLAUDE_CODE_BIN,
      args: buildCliArgs({ modelId, systemPromptFile, jsonSchema }),
      stdin: stdinLine(input.content),
      cwd,
      timeoutMs: env.CLAUDE_CODE_TIMEOUT_MS,
      signal: options.abortSignal,
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? null;
    throw new AiError(explainCliFailure({ code }), { cause: e });
  } finally {
    release();
    await fs.rm(tmp, { recursive: true, force: true });
  }

  if (out.timedOut) {
    throw new AiError("Claude Code took too long to answer. Please try again.");
  }
  if (options.abortSignal?.aborted) throw new AiError("The AI request was cancelled.");

  const result = parseCliOutput(out.stdout);
  if (!result.ok) {
    throw new AiError(
      explainCliFailure({ message: result.message, status: result.status, stderr: out.stderr }),
      { cause: new Error(`claude exit ${out.exitCode}: ${result.message}`) },
    );
  }

  return {
    content: [{ type: "text", text: result.text }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: {
        total: result.usage.inputTokens,
        noCache: result.usage.inputTokens - result.usage.cacheReadTokens,
        cacheRead: result.usage.cacheReadTokens,
        cacheWrite: result.usage.cacheWriteTokens,
      },
      outputTokens: { total: result.usage.outputTokens, text: undefined, reasoning: undefined },
    },
    response: { modelId: result.model ?? modelId },
    // maxOutputTokens has no CLI flag: ignored on purpose (no warning, it would log every call).
    warnings: [],
  };
}

/**
 * AI SDK model backed by the local Claude Code CLI (`AI_PROVIDER=claude-code`).
 * Every call spawns `claude -p` in the agents folder with no tools; see DECISIONS (plan 07).
 */
export function createClaudeCodeModel(modelId: string, task: string): ModelV4 {
  return {
    specificationVersion: "v4",
    provider: "claude-code",
    modelId,
    supportedUrls: {},
    doGenerate: (options) => generate(modelId, task, options),
    doStream: () => {
      throw new AiError("Streaming is not supported by the Claude Code provider.");
    },
  };
}
