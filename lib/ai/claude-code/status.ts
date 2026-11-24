import "server-only";
import { execFile } from "node:child_process";
import { env } from "@/lib/env";
import { agentsDirExists } from "./agents";
import { childEnv } from "./args";
import { explainCliFailure } from "./parse";

export type ClaudeCodeStatus = { ready: boolean; version: string | null; message: string };

let cached: { at: number; value: ClaudeCodeStatus } | null = null;
const TTL_MS = 60_000;

function version(bin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      ["--version"],
      { timeout: 10_000, env: childEnv(process.env) },
      (error, stdout) => (error ? reject(error) : resolve(stdout.trim())),
    );
  });
}

/**
 * Is the Claude Code CLI installed and the agents folder present? (cached 60 s).
 * Does not spend a model call, so a logged-out CLI is only detected on the first real call.
 */
export async function claudeCodeStatus(now = Date.now()): Promise<ClaudeCodeStatus> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  let value: ClaudeCodeStatus;
  try {
    const v = await version(env.CLAUDE_CODE_BIN);
    value = agentsDirExists(env.CLAUDE_AGENTS_DIR)
      ? { ready: true, version: v, message: `Claude Code found (${v}).` }
      : {
          ready: false,
          version: v,
          message: "Claude Code found, but the agents folder is missing. Check CLAUDE_AGENTS_DIR.",
        };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? null;
    value = { ready: false, version: null, message: explainCliFailure({ code: String(code) }) };
  }
  cached = { at: now, value };
  return value;
}
