import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiUsage, userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { assertCallCap, countOnLocalDay, createOperation } from "../budget";
import { AiError, BudgetError } from "../errors";
import { aiObject, aiText } from "../run";
import { buildCliArgs, buildSystemPrompt, childEnv, promptToCliInput, stdinLine } from "./args";
import { explainCliFailure, parseCliOutput } from "./parse";
import { Semaphore } from "./semaphore";

const FIXTURES = path.resolve(__dirname, "../../../tests/fixtures/claude-code");
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

describe("promptToCliInput", () => {
  it("passes a single user turn as is, with base64 images", () => {
    const input = promptToCliInput([
      { role: "system", content: "Be a tutor." },
      {
        role: "user",
        content: [
          { type: "text", text: "Read this page." },
          {
            type: "file",
            mediaType: "image/png",
            data: { type: "data", data: new Uint8Array([1, 2, 3]) },
          },
        ],
      },
    ]);
    expect(input.system).toBe("Be a tutor.");
    expect(input.content).toEqual([
      { type: "text", text: "Read this page." },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AQID" } },
    ]);
  });

  it("quotes earlier turns when the call is a conversation (zod retry)", () => {
    const input = promptToCliInput([
      { role: "system", content: "S" },
      { role: "user", content: [{ type: "text", text: "Give a word." }] },
      { role: "assistant", content: [{ type: "text", text: "not json" }] },
      { role: "user", content: [{ type: "text", text: "Answer again with JSON." }] },
    ]);
    expect(input.content.map((b) => (b.type === "text" ? b.text : "img"))).toEqual([
      "[Learner request]",
      "Give a word.",
      "[Your previous answer]\nnot json",
      "[Learner request]",
      "Answer again with JSON.",
    ]);
  });

  it("refuses files that are not images", () => {
    expect(() =>
      promptToCliInput([
        {
          role: "user",
          content: [
            { type: "file", mediaType: "application/pdf", data: { type: "data", data: "eA==" } },
          ],
        },
      ]),
    ).toThrow(/unsupported file type/);
  });
});

describe("CLI args, stdin, env", () => {
  it("builds a tool-less print-mode call with the schema", () => {
    const args = buildCliArgs({
      modelId: "sonnet",
      systemPromptFile: "/tmp/x/system.md",
      jsonSchema: { type: "object" },
    });
    expect(args).toContain("-p");
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args[args.indexOf("--model") + 1]).toBe("sonnet");
    expect(args[args.indexOf("--system-prompt-file") + 1]).toBe("/tmp/x/system.md");
    expect(args[args.indexOf("--json-schema") + 1]).toBe('{"type":"object"}');
    expect(args).toContain("--no-session-persistence");
    expect(buildCliArgs({ modelId: "m", systemPromptFile: "f" })).not.toContain("--json-schema");
  });

  it("writes one stream-json user line", () => {
    const line = stdinLine([{ type: "text", text: "물" }]);
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toEqual({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "물" }] },
    });
  });

  it("puts the agents instructions before the task prompt", () => {
    expect(buildSystemPrompt("Tutor rules", "Task rules")).toBe("Tutor rules\n\n---\n\nTask rules");
    expect(buildSystemPrompt("", "Task rules")).toBe("Task rules");
  });

  it("never passes API keys to the CLI", () => {
    const parent = {
      ANTHROPIC_API_KEY: "k",
      ANTHROPIC_AUTH_TOKEN: "t",
      CLAUDECODE: "1",
      PATH: "/bin",
    };
    const env = childEnv(parent as unknown as NodeJS.ProcessEnv);
    expect(env).toEqual({ PATH: "/bin" });
  });
});

describe("parseCliOutput", () => {
  it("reads structured output from a recorded real run", () => {
    const r = parseCliOutput(fixture("result-structured.jsonl"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.structured as { colours: string[] }).colours).toHaveLength(3);
    expect(JSON.parse(r.text)).toEqual(r.structured);
    expect(r.usage).toEqual({
      inputTokens: 4402,
      outputTokens: 219,
      cacheReadTokens: 0,
      cacheWriteTokens: 4400,
    });
    expect(r.model).toBe("claude-haiku-5-5");
  });

  it("reads an error from a recorded real run", () => {
    const r = parseCliOutput(fixture("result-error.jsonl"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
    expect(explainCliFailure(r)).toMatch(/does not know this model/);
  });

  it("handles output without a result line", () => {
    expect(parseCliOutput("garbage\n{not json\n").ok).toBe(false);
  });

  it("explains common failures", () => {
    expect(explainCliFailure({ code: "ENOENT" })).toMatch(/not installed/);
    expect(explainCliFailure({ message: "Not logged in · Please run /login" })).toMatch(
      /not logged in/,
    );
    expect(explainCliFailure({ status: 429 })).toMatch(/usage limit/);
    expect(explainCliFailure({ message: "boom" })).toMatch(/could not answer/);
  });
});

describe("Semaphore", () => {
  it("runs at most `limit` at once, in order", async () => {
    const s = new Semaphore(1);
    const order: number[] = [];
    const r1 = await s.acquire();
    const p2 = s.acquire().then((r) => {
      order.push(2);
      return r;
    });
    expect(s.waiting).toBe(1);
    order.push(1);
    r1();
    const r2 = await p2;
    expect(order).toEqual([1, 2]);
    expect(s.running).toBe(1);
    r2();
    r2(); // double release is a no-op
    expect(s.running).toBe(0);
  });
});

describe("daily call cap", () => {
  it("counts calls on the local day only", () => {
    const now = new Date("2026-11-24T10:00:00Z"); // 19:00 in Seoul
    const dates = [
      new Date("2026-11-24T09:00:00Z"),
      new Date("2026-11-23T16:00:00Z"), // 01:00 Seoul on the 24th
      new Date("2026-11-23T14:00:00Z"), // 23:00 Seoul on the 23rd
    ];
    expect(countOnLocalDay(dates, now, "Asia/Seoul")).toBe(2);
    expect(countOnLocalDay(dates, now, "UTC")).toBe(1);
  });
});

// ---- end to end through aiObject / aiText with the fake CLI ----

const FAKE = path.join(FIXTURES, "fake-claude.mjs");
const schema = z.object({ word: z.string(), meaning: z.string() });

describe("claude-code provider (fake CLI)", () => {
  let db: Db;
  let tmp: string;
  let log: string;
  let agentsDir: string;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mll-cc-test-"));
    log = path.join(tmp, "calls.jsonl");
    agentsDir = path.join(tmp, "agents");
    fs.mkdirSync(agentsDir);
    fs.writeFileSync(path.join(agentsDir, "CLAUDE.md"), "TUTOR RULES");
    vi.stubEnv("AI_MOCK", "0");
    vi.stubEnv("AI_PROVIDER", "claude-code");
    vi.stubEnv("AI_MODEL_SMART", "sonnet");
    vi.stubEnv("CLAUDE_CODE_BIN", FAKE);
    vi.stubEnv("CLAUDE_AGENTS_DIR", agentsDir);
    vi.stubEnv("CLAUDE_CODE_TIMEOUT_MS", "");
    vi.stubEnv("FAKE_CLAUDE_LOG", log);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-should-not-leak");
    db = await createTestDb();
    await db.insert(userSettings).values({ userId: TEST_USER_ID, aiCallsDailyCap: 3 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const calls = () =>
    fs
      .readFileSync(log, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  const respond = (responses: unknown[]) =>
    vi.stubEnv("FAKE_CLAUDE_RESPONSES", JSON.stringify(responses));
  const ask = () =>
    aiObject({
      db,
      userId: TEST_USER_ID,
      operation: createOperation(TEST_USER_ID, "test"),
      task: "test.echo",
      tier: "smart",
      schema,
      system: "TASK RULES",
      prompt: "Give me a word.",
      maxOutputTokens: 500,
    });

  it("returns the structured object without any price row, logs cost 0", async () => {
    respond([{ structured: { word: "물", meaning: "water" } }]);
    await expect(ask()).resolves.toEqual({ word: "물", meaning: "water" });

    const [call] = calls();
    expect(call.cwd).toBe(fs.realpathSync(agentsDir));
    expect(call.system).toBe("TUTOR RULES\n\n---\n\nTASK RULES");
    expect(call.args[call.args.indexOf("--model") + 1]).toBe("sonnet");
    expect(JSON.parse(call.args[call.args.indexOf("--json-schema") + 1]).type).toBe("object");
    expect(call.stdin.message.content).toEqual([{ type: "text", text: "Give me a word." }]);
    expect(call.env).toEqual({
      ANTHROPIC_API_KEY: null,
      ANTHROPIC_AUTH_TOKEN: null,
      CLAUDECODE: null,
    });

    const [row] = await db.select().from(aiUsage);
    expect(row).toMatchObject({
      provider: "claude-code",
      model: "sonnet",
      status: "ok",
      costUsd: 0,
      inputTokens: 153,
      outputTokens: 20,
      cachedInputTokens: 50,
    });
  });

  it("retries once when the answer is not valid JSON", async () => {
    respond([
      { text: "sorry, here it is: word=물" },
      { structured: { word: "물", meaning: "water" } },
    ]);
    await expect(ask()).resolves.toEqual({ word: "물", meaning: "water" });
    const second = calls()[1];
    const texts = second.stdin.message.content.map((b: { text: string }) => b.text);
    expect(texts).toContain("[Your previous answer]\nsorry, here it is: word=물");
    const rows = await db.select().from(aiUsage).orderBy(aiUsage.createdAt);
    expect(rows.map((r) => r.status)).toEqual(["error", "ok"]);
  });

  it("aiText returns the plain result", async () => {
    respond([{ text: "Water." }]);
    const text = await aiText({
      db,
      userId: TEST_USER_ID,
      operation: createOperation(TEST_USER_ID, "test"),
      task: "test.text",
      tier: "smart",
      system: "S",
      prompt: "What is 물?",
      maxOutputTokens: 100,
    });
    expect(text).toBe("Water.");
    expect(calls()[0].args).not.toContain("--json-schema");
  });

  it("shows a clear message for CLI errors", async () => {
    respond([{ error: "You've hit your usage limit", status: 429 }]);
    await expect(ask()).rejects.toThrow(/usage limit is reached/);
    const [row] = await db.select().from(aiUsage);
    expect(row.status).toBe("error");
  });

  it("reports a missing binary", async () => {
    vi.stubEnv("CLAUDE_CODE_BIN", path.join(tmp, "no-such-claude"));
    await expect(ask()).rejects.toThrow(/not installed/);
  });

  it("reports a missing agents folder", async () => {
    vi.stubEnv("CLAUDE_AGENTS_DIR", path.join(tmp, "missing"));
    await expect(ask()).rejects.toThrow(AiError);
  });

  it("kills a call that takes too long", async () => {
    vi.stubEnv("CLAUDE_CODE_TIMEOUT_MS", "5000");
    respond([{ sleep: 20_000 }]);
    const started = Date.now();
    await expect(ask()).rejects.toThrow(/took too long/);
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it("blocks after the daily call cap and logs it", async () => {
    respond([{ structured: { word: "물", meaning: "water" } }]);
    for (let i = 0; i < 3; i++) await ask();
    await expect(ask()).rejects.toThrow(BudgetError);
    await expect(ask()).rejects.toThrow(/Daily AI call limit reached \(3 of 3/);
    const rows = await db.select().from(aiUsage);
    expect(rows.filter((r) => r.status === "blocked")).toHaveLength(2);
    expect(calls()).toHaveLength(3);
    await expect(
      assertCallCap(db, TEST_USER_ID, "claude-code", { aiCallsDailyCap: 4, timezone: "UTC" }),
    ).resolves.toBeUndefined();
  });

  it("mock mode still wins over claude-code", async () => {
    vi.stubEnv("AI_MOCK", "1");
    await expect(ask()).resolves.toBeTruthy();
    expect(fs.existsSync(log)).toBe(false);
  });
});
