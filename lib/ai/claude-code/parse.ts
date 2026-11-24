/** Pure parsing of `claude -p --output-format stream-json` output. */

export type CliUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type CliResult =
  | { ok: true; text: string; structured: unknown; usage: CliUsage; model: string | null }
  | { ok: false; message: string; status: number | null; usage: CliUsage };

const ZERO: CliUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

type RawResult = {
  type: "result";
  is_error?: boolean;
  subtype?: string;
  result?: string;
  structured_output?: unknown;
  api_error_status?: number | null;
  errors?: string[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function toUsage(u: RawResult["usage"]): CliUsage {
  if (!u) return ZERO;
  const cacheRead = num(u.cache_read_input_tokens);
  const cacheWrite = num(u.cache_creation_input_tokens);
  return {
    inputTokens: num(u.input_tokens) + cacheRead + cacheWrite,
    outputTokens: num(u.output_tokens),
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
  };
}

/** The last `{"type":"result"}` line of the output, or null. Other lines are ignored. */
export function findResultLine(stdout: string): RawResult | null {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      const value = JSON.parse(line) as { type?: string };
      if (value.type === "result") return value as RawResult;
    } catch {
      // not JSON (e.g. a debug line) — skip
    }
  }
  return null;
}

/** Parses the CLI output. `structured` is set when the call used `--json-schema`. */
export function parseCliOutput(stdout: string): CliResult {
  const r = findResultLine(stdout);
  if (!r)
    return { ok: false, message: "no result in Claude Code output", status: null, usage: ZERO };
  const usage = toUsage(r.usage);
  if (r.is_error || (r.subtype && r.subtype !== "success")) {
    const message = r.result || r.errors?.join("; ") || r.subtype || "Claude Code error";
    return { ok: false, message, status: r.api_error_status ?? null, usage };
  }
  const model = r.modelUsage ? (Object.keys(r.modelUsage)[0] ?? null) : null;
  const structured = r.structured_output;
  const text =
    structured !== undefined && structured !== null ? JSON.stringify(structured) : (r.result ?? "");
  return { ok: true, text, structured, usage, model };
}

/** User-facing explanation of a CLI failure (shown in the app; no secrets in it). */
export function explainCliFailure(input: {
  message?: string;
  status?: number | null;
  stderr?: string;
  code?: string | null;
}): string {
  if (input.code === "ENOENT") {
    return "Claude Code is not installed on this server (the `claude` command was not found). Install it in WSL, or set CLAUDE_CODE_BIN.";
  }
  const text = `${input.message ?? ""}\n${input.stderr ?? ""}`.toLowerCase();
  if (
    input.status === 401 ||
    /not logged in|please run \/login|invalid api key|authentication|oauth token/.test(text)
  ) {
    return "Claude Code is not logged in on this server. Run `claude` once in WSL and log in.";
  }
  if (input.status === 429 || /usage limit|rate limit|limit reached|limit will reset/.test(text)) {
    return "Your Claude plan's usage limit is reached. Try again later.";
  }
  if (input.status === 404 || /issue with the selected model|not_found/.test(text)) {
    return "Claude Code does not know this model. Check the model names in Settings → AI.";
  }
  return "Claude Code could not answer. Please try again.";
}
