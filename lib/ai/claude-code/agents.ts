import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  agentsPaths,
  buildAppendedPrompt,
  DEFAULT_AGENTS_MAX_BYTES,
  manifestSchema,
  resolveTask,
  skillToolHint,
  type AgentsManifest,
  type AgentsSkillMode,
  type PromptPart,
} from "./agents-prompt";

/**
 * Reads the agents folder (`CLAUDE_AGENTS_DIR`, plan 08) and builds the instructions the
 * adapter puts before the task's system prompt. Read by the app (not by Claude Code's
 * auto-discovery) so every call gets them. Files are cached by mtime: edits apply
 * without restarting the server.
 */
const cache = new Map<string, { mtimeMs: number; text: string }>();

/** File text, or null when missing. */
function readCached(file: string): string | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
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

/** Parsed `manifest.json`, null when missing. Throws a clear error when it is invalid. */
export function readManifest(dir: string): AgentsManifest | null {
  const text = readCached(path.join(dir, agentsPaths.manifest));
  if (text === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("langlearner-agents/manifest.json is not valid JSON.");
  }
  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`langlearner-agents/manifest.json is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

const warnedOnce = new Set<string>();
function warnOnce(message: string) {
  if (warnedOnce.has(message)) return;
  warnedOnce.add(message);
  console.warn(`[claude-code] ${message}`);
}

export type AgentsContext = {
  /** CLAUDE.md, persona, profile, shared skills, task skill — joined, without frontmatter. */
  appendedPrompt: string;
  /** Skill names the model may load itself (tool mode only). */
  toolSkills: string[];
  warnings: string[];
};

export type AgentsOptions = { mode?: AgentsSkillMode; maxBytes?: number };

/**
 * Instructions for one call: `CLAUDE.md`, the task's persona, the learner profile
 * (`profile.local.md`, else the example), the language's shared skills and the task skill.
 * A task missing from the manifest gets `CLAUDE.md` only (warned once).
 */
export function loadAgentsContext(
  dir: string,
  task: string,
  language: string,
  opts: AgentsOptions = {},
): AgentsContext {
  const mode = opts.mode ?? "inline";
  const warnings: string[] = [];
  const read = (rel: string, what: string): string => {
    const text = readCached(path.join(dir, rel));
    if (text === null) warnings.push(`${what} not found (${rel}).`);
    return text ?? "";
  };

  const parts: PromptPart[] = [
    { label: agentsPaths.claude, text: read(agentsPaths.claude, "CLAUDE.md") },
  ];
  const toolSkills: string[] = [];

  const manifest = readManifest(dir);
  const resolved = manifest ? resolveTask(manifest, task, language) : null;
  if (!manifest) warnings.push(`manifest.json not found: only CLAUDE.md is used.`);
  else if (!resolved) {
    const message = `AI task "${task}" is not in langlearner-agents/manifest.json: only CLAUDE.md is used.`;
    warnings.push(message);
    warnOnce(message);
  }

  if (resolved) {
    const { entry, shared } = resolved;
    parts.push({
      label: agentsPaths.agent(entry.agent),
      text: read(agentsPaths.agent(entry.agent), `Persona "${entry.agent}"`),
    });

    const local = readCached(path.join(dir, agentsPaths.profileLocal));
    if (local !== null) parts.push({ label: agentsPaths.profileLocal, text: local });
    else {
      warnings.push("learner/profile.local.md not found: using profile.example.md.");
      parts.push({
        label: agentsPaths.profileExample,
        text: read(agentsPaths.profileExample, "Learner profile"),
      });
    }

    for (const name of shared) {
      parts.push({
        label: agentsPaths.skill(name),
        text: read(agentsPaths.skill(name), `Skill "${name}"`),
      });
    }

    if (mode === "tool") {
      toolSkills.push(entry.skill);
      parts.push({ label: "skill hint", text: skillToolHint(entry.skill) });
    } else {
      parts.push({
        label: agentsPaths.skill(entry.skill),
        text: read(agentsPaths.skill(entry.skill), `Skill "${entry.skill}"`),
      });
    }
  }

  return {
    appendedPrompt: buildAppendedPrompt(parts, opts.maxBytes ?? DEFAULT_AGENTS_MAX_BYTES),
    toolSkills,
    warnings,
  };
}
