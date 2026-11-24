import { afterEach, describe, expect, it, vi } from "vitest";
import { env, EnvError } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("throws a clear error only when a missing var is read", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => env.DATABASE_URL).toThrow(EnvError);
    expect(() => env.DATABASE_URL).toThrow(/DATABASE_URL is not set/);
  });

  it("validates values", () => {
    vi.stubEnv("DATABASE_URL", "mysql://x");
    expect(() => env.DATABASE_URL).toThrow(/invalid/);
    vi.stubEnv("AI_PROVIDER", "mistral");
    expect(() => env.AI_PROVIDER).toThrow(/AI_PROVIDER is invalid/);
  });

  it("applies defaults", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_MODEL_SMART", "");
    expect(env.AI_PROVIDER).toBe("anthropic");
    expect(env.AI_MODEL_SMART).toBe("claude-sonnet-5-5");
  });

  it("accepts the claude-code provider and its options", () => {
    vi.stubEnv("AI_PROVIDER", "claude-code");
    expect(env.AI_PROVIDER).toBe("claude-code");
    for (const name of [
      "CLAUDE_CODE_BIN",
      "CLAUDE_AGENTS_DIR",
      "CLAUDE_CODE_TIMEOUT_MS",
      "CLAUDE_CODE_MAX_CONCURRENT",
    ]) {
      vi.stubEnv(name, "");
    }
    expect(env.CLAUDE_CODE_BIN).toBe("claude");
    expect(env.CLAUDE_AGENTS_DIR).toMatch(/langlearner-agents$/);
    expect(env.CLAUDE_CODE_TIMEOUT_MS).toBe(180_000);
    expect(env.CLAUDE_CODE_MAX_CONCURRENT).toBe(2);
    vi.stubEnv("CLAUDE_CODE_TIMEOUT_MS", "100");
    expect(() => env.CLAUDE_CODE_TIMEOUT_MS).toThrow(/CLAUDE_CODE_TIMEOUT_MS is invalid/);
    vi.stubEnv("CLAUDE_CODE_MAX_CONCURRENT", "3");
    expect(env.CLAUDE_CODE_MAX_CONCURRENT).toBe(3);
  });

  it("parses MAGIC_LINK_LOGIN (on by default)", () => {
    vi.stubEnv("MAGIC_LINK_LOGIN", "");
    expect(env.MAGIC_LINK_LOGIN).toBe(true);
    for (const v of ["1", "true", "ON"]) {
      vi.stubEnv("MAGIC_LINK_LOGIN", v);
      expect(env.MAGIC_LINK_LOGIN).toBe(true);
    }
    for (const v of ["0", "false", "Off"]) {
      vi.stubEnv("MAGIC_LINK_LOGIN", v);
      expect(env.MAGIC_LINK_LOGIN).toBe(false);
    }
    vi.stubEnv("MAGIC_LINK_LOGIN", "maybe");
    expect(() => env.MAGIC_LINK_LOGIN).toThrow(/MAGIC_LINK_LOGIN/);
  });

  it("parses ALLOWED_EMAILS", () => {
    vi.stubEnv("ALLOWED_EMAILS", " A@x.com, b@y.com ,");
    expect(env.ALLOWED_EMAILS).toEqual(["a@x.com", "b@y.com"]);
  });

  it("never enables DEV_USER_ID in production", () => {
    vi.stubEnv("DEV_USER_ID", "00000000-0000-4000-8000-000000000001");
    vi.stubEnv("NODE_ENV", "production");
    expect(env.DEV_USER_ID).toBeUndefined();
    vi.stubEnv("NODE_ENV", "development");
    expect(env.DEV_USER_ID).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("NO_LOGIN_USER_ID works in production and must be a uuid", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NO_LOGIN_USER_ID", "00000000-0000-4000-8000-000000000001");
    expect(env.NO_LOGIN_USER_ID).toBe("00000000-0000-4000-8000-000000000001");
    expect(env.BYPASS_USER_ID).toBe("00000000-0000-4000-8000-000000000001");
    vi.stubEnv("NO_LOGIN_USER_ID", "nope");
    expect(() => env.NO_LOGIN_USER_ID).toThrow(/NO_LOGIN_USER_ID is invalid/);
    vi.stubEnv("NO_LOGIN_USER_ID", "");
    expect(env.BYPASS_USER_ID).toBeUndefined();
  });
});
