/**
 * Pure helpers turning an AI SDK call into a `claude -p` invocation
 * (arguments, stdin message, system prompt, child env). No I/O here.
 */
import type { MockLanguageModelV4 } from "ai/test";

export type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type Prompt = CallOptions["prompt"];

export type CliContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type CliInput = {
  /** Every system message of the call, joined. */
  system: string;
  /** One user message for stream-json stdin (earlier turns quoted as text). */
  content: CliContentBlock[];
};

/** Image types the Claude API accepts. */
export const CLI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

function toBase64(data: Uint8Array | string): string {
  return typeof data === "string" ? data : Buffer.from(data).toString("base64");
}

type FilePart = Extract<
  Extract<Prompt[number], { role: "user" }>["content"][number],
  { type: "file" }
>;

function fileBlock(part: FilePart): CliContentBlock {
  const mediaType = part.mediaType === "image" ? "image/jpeg" : part.mediaType;
  if (!(CLI_IMAGE_TYPES as readonly string[]).includes(mediaType)) {
    throw new Error(`Claude Code: unsupported file type ${part.mediaType} (images only).`);
  }
  if (part.data.type === "text") return { type: "text", text: part.data.text };
  if (part.data.type !== "data") {
    throw new Error("Claude Code: files must be sent as data (URLs are not supported).");
  }
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: toBase64(part.data.data) },
  };
}

/**
 * Flattens the AI SDK prompt into a system text + one user message.
 * With a single user turn (the normal case) the content is passed as is; when the
 * call contains earlier turns (zod retry), they are quoted so the model sees them.
 */
export function promptToCliInput(prompt: Prompt): CliInput {
  const system: string[] = [];
  const turns = prompt.filter((m) => m.role !== "system");
  const multiTurn = turns.length > 1;
  const content: CliContentBlock[] = [];

  for (const message of prompt) {
    if (message.role === "system") {
      system.push(message.content);
      continue;
    }
    if (message.role === "user") {
      if (multiTurn) content.push({ type: "text", text: "[Learner request]" });
      for (const part of message.content) {
        content.push(part.type === "text" ? { type: "text", text: part.text } : fileBlock(part));
      }
      continue;
    }
    if (message.role === "assistant") {
      const text = message.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      content.push({ type: "text", text: `[Your previous answer]\n${text}` });
      continue;
    }
    throw new Error("Claude Code: tool messages are not supported.");
  }

  if (content.length === 0) content.push({ type: "text", text: "" });
  return { system: system.join("\n\n"), content };
}

/** The single stdin line (stream-json) carrying the user message. */
export function stdinLine(content: CliContentBlock[]): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;
}

/** Agents-folder instructions first, then the task's own system prompt (it wins on format). */
export function buildSystemPrompt(agentsInstructions: string, taskSystem: string): string {
  return [agentsInstructions.trim(), taskSystem.trim()].filter(Boolean).join("\n\n---\n\n");
}

export function buildCliArgs(opts: {
  modelId: string;
  systemPromptFile: string;
  jsonSchema?: unknown;
}): string[] {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    // No tools at all: one question, one answer.
    "--tools",
    "",
    "--no-session-persistence",
    "--strict-mcp-config",
    // Only the agents folder's .claude/settings.json (not the owner's user settings).
    "--setting-sources",
    "project",
    "--model",
    opts.modelId,
    "--system-prompt-file",
    opts.systemPromptFile,
  ];
  if (opts.jsonSchema !== undefined) args.push("--json-schema", JSON.stringify(opts.jsonSchema));
  return args;
}

/** Variables that would make `claude` bill an API key, or think it runs nested. */
export const STRIPPED_ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE"] as const;

export function childEnv(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...parent };
  for (const name of STRIPPED_ENV) delete env[name];
  return env;
}
