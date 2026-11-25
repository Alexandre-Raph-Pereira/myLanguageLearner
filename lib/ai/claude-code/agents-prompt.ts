/**
 * Pure helpers for the `langlearner-agents/` folder (plan 08): manifest schema,
 * frontmatter parsing and the appended system prompt. No I/O here.
 */
import { z } from "zod";

/** Default cap on the agents part of the system prompt (the task prompt is not counted). */
export const DEFAULT_AGENTS_MAX_BYTES = 24 * 1024;

export const AGENTS_SKILL_MODES = ["inline", "tool"] as const;
export type AgentsSkillMode = (typeof AGENTS_SKILL_MODES)[number];

const fileName = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes");

export const manifestTaskSchema = z.object({
  skill: fileName,
  agent: fileName,
  /** `false` = no shared (language) skills for this task. */
  shared: z.boolean().optional(),
  notes: z.string().optional(),
});

export const manifestSchema = z.object({
  version: z.literal(1),
  /** Shared skills per target language, e.g. `{ "ko": ["korean-teaching"] }`. */
  shared: z.record(z.string(), z.array(fileName)),
  tasks: z.record(z.string(), manifestTaskSchema),
});

export type AgentsManifest = z.infer<typeof manifestSchema>;
export type ManifestTask = z.infer<typeof manifestTaskSchema>;

/** Paths of the folder's files, relative to the agents dir. */
export const agentsPaths = {
  claude: "CLAUDE.md",
  manifest: "manifest.json",
  profileLocal: "learner/profile.local.md",
  profileExample: "learner/profile.example.md",
  skill: (name: string) => `.claude/skills/${name}/SKILL.md`,
  agent: (name: string) => `.claude/agents/${name}.md`,
};

export type Frontmatter = { data: Record<string, string>; body: string };

/**
 * Splits `---\nkey: value\n---\nbody`. Values are kept as raw strings (quotes removed);
 * only the flat `key: value` lines Claude Code skills and agents use are supported.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const src = text.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    data[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, body: src.slice(m[0].length) };
}

export function stripFrontmatter(text: string): string {
  return parseFrontmatter(text).body;
}

/** The task entry and its shared skills for a language (null when the task is not listed). */
export function resolveTask(
  manifest: AgentsManifest,
  task: string,
  language: string,
): { entry: ManifestTask; shared: string[] } | null {
  const entry = manifest.tasks[task];
  if (!entry) return null;
  const shared = entry.shared === false ? [] : (manifest.shared[language] ?? []);
  return { entry, shared };
}

export type PromptPart = { label: string; text: string };

export class AgentsPromptTooLargeError extends Error {
  constructor(
    readonly bytes: number,
    readonly maxBytes: number,
    readonly sizes: { label: string; bytes: number }[],
  ) {
    super(
      `langlearner-agents instructions are too large (${bytes} bytes, limit ${maxBytes}). ` +
        `Shorten the biggest files: ${sizes
          .slice()
          .sort((a, b) => b.bytes - a.bytes)
          .map((s) => `${s.label} ${s.bytes} B`)
          .join(", ")}.`,
    );
    this.name = "AgentsPromptTooLargeError";
  }
}

const SEPARATOR = "\n\n---\n\n";

/**
 * Joins the parts (frontmatter stripped, empty parts dropped) with `---` separators.
 * Throws `AgentsPromptTooLargeError` above `maxBytes` (UTF-8).
 */
export function buildAppendedPrompt(
  parts: PromptPart[],
  maxBytes = DEFAULT_AGENTS_MAX_BYTES,
): string {
  const kept = parts
    .map((p) => ({ label: p.label, text: stripFrontmatter(p.text).trim() }))
    .filter((p) => p.text.length > 0);
  const prompt = kept.map((p) => p.text).join(SEPARATOR);
  const bytes = Buffer.byteLength(prompt, "utf8");
  if (bytes > maxBytes) {
    throw new AgentsPromptTooLargeError(
      bytes,
      maxBytes,
      kept.map((p) => ({ label: p.label, bytes: Buffer.byteLength(p.text, "utf8") })),
    );
  }
  return prompt;
}

/** Line telling the model to load the task skill itself (`CLAUDE_AGENTS_SKILL_MODE=tool`). */
export function skillToolHint(skill: string): string {
  return `Before answering, load the skill \`${skill}\` with the Skill tool and follow its guidance.`;
}
