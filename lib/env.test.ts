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
});
