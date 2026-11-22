import fs from "node:fs";
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

/**
 * Mock models for AI_MOCK=1. Each task answers from
 * `tests/fixtures/ai/<task>.json`:
 *
 *   { "responses": [ <response>, ... ], "usage": { "input": 120, "output": 80 } }
 *
 * A response that is a string is returned as raw model text (useful to test
 * invalid JSON); any other JSON value is returned stringified (the structured
 * output). Responses are served in order per task; the last one repeats.
 */

export type MockFixture = {
  responses: unknown[];
  usage?: { input?: number; output?: number; cacheRead?: number };
};

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures", "ai");
const overrides = new Map<string, MockFixture>();
const counters = new Map<string, number>();
const calls: { task: string; options: CallOptions }[] = [];

/** Test helper: options (prompt, provider options…) received by mock models, oldest first. */
export function getMockCalls(task?: string): CallOptions[] {
  return calls.filter((c) => !task || c.task === task).map((c) => c.options);
}

/** Test helper: serve these responses for `task` instead of the fixture file. */
export function setMockFixture(task: string, fixture: MockFixture): void {
  overrides.set(task, fixture);
  counters.delete(task);
}

/** Test helper: forget overrides and restart every task at its first response. */
export function resetMockFixtures(): void {
  overrides.clear();
  counters.clear();
  calls.length = 0;
}

export function loadFixture(task: string): MockFixture {
  const override = overrides.get(task);
  if (override) return override;
  if (!/^[a-z0-9_.-]+$/i.test(task)) throw new Error(`Invalid AI task name "${task}"`);
  const file = path.join(FIXTURES_DIR, `${task}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`AI_MOCK: no fixture for task "${task}" (expected ${file})`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as MockFixture;
  if (!Array.isArray(parsed.responses) || parsed.responses.length === 0) {
    throw new Error(`AI_MOCK: fixture ${file} must have a non-empty "responses" array`);
  }
  return parsed;
}

function nextResponse(task: string): { text: string; fixture: MockFixture } {
  const fixture = loadFixture(task);
  const i = counters.get(task) ?? 0;
  counters.set(task, i + 1);
  const value = fixture.responses[Math.min(i, fixture.responses.length - 1)];
  return { text: typeof value === "string" ? value : JSON.stringify(value), fixture };
}

export function createMockModel(task: string, modelId: string) {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId,
    doGenerate: async (options) => {
      calls.push({ task, options });
      if (calls.length > 100) calls.shift(); // bounded: dev servers run in mock mode too
      const { text, fixture } = nextResponse(task);
      const input = fixture.usage?.input ?? 100;
      const output = fixture.usage?.output ?? 50;
      const cacheRead = fixture.usage?.cacheRead ?? 0;
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: input,
            noCache: input - cacheRead,
            cacheRead,
            cacheWrite: undefined,
          },
          outputTokens: { total: output, text: output, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
