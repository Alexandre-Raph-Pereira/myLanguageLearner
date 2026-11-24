#!/usr/bin/env node
// Fake `claude` CLI for tests (CLAUDE_CODE_BIN). Reads the stream-json stdin line,
// logs what it received to $FAKE_CLAUDE_LOG (one JSON line per call) and answers from
// $FAKE_CLAUDE_RESPONSES (JSON array, served in order, last one repeats). Each response:
//   { "structured": <value> }         → success with structured_output
//   { "text": "..." }                  → success with a plain result text
//   { "error": "...", "status": 429 }  → is_error result, exit 1
//   { "sleep": 10000 }                 → never answers in time
//   { "crash": "message" }             → writes to stderr, exits 2 without a result line
import fs from "node:fs";

const args = process.argv.slice(2);
if (args.includes("--version")) {
  process.stdout.write("9.9.9 (Claude Code)\n");
  process.exit(0);
}

const stdin = fs.readFileSync(0, "utf8");
const at = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};
const systemFile = at("--system-prompt-file");
const log = process.env.FAKE_CLAUDE_LOG;
let index = 0;
if (log) {
  index = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
  fs.appendFileSync(
    log,
    JSON.stringify({
      args,
      cwd: process.cwd(),
      stdin: JSON.parse(stdin),
      system: systemFile ? fs.readFileSync(systemFile, "utf8") : null,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? null,
        CLAUDECODE: process.env.CLAUDECODE ?? null,
      },
    }) + "\n",
  );
}

const responses = JSON.parse(process.env.FAKE_CLAUDE_RESPONSES ?? '[{"text":"ok"}]');
const r = responses[Math.min(index, responses.length - 1)];
const usage = {
  input_tokens: 3,
  cache_creation_input_tokens: 100,
  cache_read_input_tokens: 50,
  output_tokens: 20,
};
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");

out({ type: "system", subtype: "init", model: at("--model") });
if (r.sleep) {
  setTimeout(() => process.exit(0), r.sleep);
} else if (r.crash) {
  process.stderr.write(r.crash + "\n");
  process.exit(2);
} else if (r.error) {
  out({
    type: "result",
    subtype: "success",
    is_error: true,
    api_error_status: r.status ?? null,
    result: r.error,
    usage: { input_tokens: 0, output_tokens: 0 },
  });
  process.exit(1);
} else {
  const structured = "structured" in r ? r.structured : undefined;
  out({
    type: "result",
    subtype: "success",
    is_error: false,
    result: structured !== undefined ? JSON.stringify(structured) : r.text,
    ...(structured !== undefined ? { structured_output: structured } : {}),
    usage,
    modelUsage: { [at("--model") ?? "unknown"]: {} },
  });
}
