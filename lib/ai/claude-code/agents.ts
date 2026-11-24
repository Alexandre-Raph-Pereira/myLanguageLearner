import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Instructions from the agents folder (`CLAUDE_AGENTS_DIR`) that the adapter puts in
 * the system prompt. Read by the app (not by Claude Code's auto-discovery) so every
 * call gets them. Cached by file mtime: edits apply without restarting the server.
 * Plan 08 extends this with the task's skill, persona and the learner profile.
 */
const cache = new Map<string, { mtimeMs: number; text: string }>();

function readCached(file: string): string {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return "";
  }
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.text;
  const text = fs.readFileSync(file, "utf8");
  cache.set(file, { mtimeMs: stat.mtimeMs, text });
  return text;
}

export function agentsDirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The folder's `CLAUDE.md` (empty string when missing). Plan 08 adds the task's skill
 * and persona here, picked by `task`.
 */
export function loadAgentsInstructions(dir: string, task: string): string {
  void task;
  return readCached(path.join(dir, "CLAUDE.md"));
}
