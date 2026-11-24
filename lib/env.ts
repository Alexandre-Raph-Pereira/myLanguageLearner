import path from "node:path";
import { z } from "zod";

/**
 * Lazily validated environment. Nothing is read at import time, so builds and
 * tests run without a full env; a missing/invalid variable throws a clear error
 * only when its getter is used.
 */

const providerSchema = z.enum(["anthropic", "openai", "google", "claude-code"]);
export type AiProviderName = z.infer<typeof providerSchema>;

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export class EnvError extends Error {
  constructor(name: string, detail: string) {
    super(`Environment variable ${name} ${detail}. See .env.example.`);
    this.name = "EnvError";
  }
}

function raw(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? undefined : v.trim();
}

function required(name: string): string {
  const v = raw(name);
  if (v === undefined) throw new EnvError(name, "is not set");
  return v;
}

function parsed<T>(name: string, schema: z.ZodType<T>, fallback?: T): T {
  const v = raw(name);
  if (v === undefined) {
    if (fallback !== undefined) return fallback;
    throw new EnvError(name, "is not set");
  }
  const r = schema.safeParse(v);
  if (!r.success) throw new EnvError(name, `is invalid (${r.error.issues[0]?.message})`);
  return r.data;
}

export const env = {
  get DATABASE_URL() {
    return parsed(
      "DATABASE_URL",
      z
        .string()
        .regex(/^(postgres(ql)?|pglite):\/\//, "must be a postgres:// (or dev-only pglite://) URL"),
    );
  },
  get NEXT_PUBLIC_SUPABASE_URL() {
    // Must be referenced literally so Next.js inlines it in client bundles.
    const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!v) throw new EnvError("NEXT_PUBLIC_SUPABASE_URL", "is not set");
    return v;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!v) throw new EnvError("NEXT_PUBLIC_SUPABASE_ANON_KEY", "is not set");
    return v;
  },
  /** Lower-cased allow-list. Empty list = nobody may log in. */
  get ALLOWED_EMAILS(): string[] {
    return (raw("ALLOWED_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  /**
   * Login by email magic link. On by default; `0` / `false` / `off` turns it off
   * (the login form, the send action and the /auth/callback link exchange all refuse).
   */
  get MAGIC_LINK_LOGIN(): boolean {
    const v = raw("MAGIC_LINK_LOGIN")?.toLowerCase();
    if (v === undefined) return true;
    if (["1", "true", "on"].includes(v)) return true;
    if (["0", "false", "off"].includes(v)) return false;
    throw new EnvError("MAGIC_LINK_LOGIN", "is invalid (use 1/0, true/false or on/off)");
  },
  get AI_PROVIDER(): AiProviderName {
    return parsed("AI_PROVIDER", providerSchema, "anthropic");
  },
  get AI_MODEL_SMART() {
    return raw("AI_MODEL_SMART") ?? DEFAULT_MODEL;
  },
  get AI_MODEL_FAST() {
    return raw("AI_MODEL_FAST") ?? DEFAULT_MODEL;
  },
  get ANTHROPIC_API_KEY() {
    return required("ANTHROPIC_API_KEY");
  },
  get OPENAI_API_KEY() {
    return required("OPENAI_API_KEY");
  },
  get GOOGLE_GENERATIVE_AI_API_KEY() {
    return required("GOOGLE_GENERATIVE_AI_API_KEY");
  },
  /** `claude` binary used by the `claude-code` provider (name on PATH or absolute path). */
  get CLAUDE_CODE_BIN(): string {
    return raw("CLAUDE_CODE_BIN") ?? "claude";
  },
  /** Working directory of the Claude Code process: the tutor's instructions (plan 08). */
  get CLAUDE_AGENTS_DIR(): string {
    return raw("CLAUDE_AGENTS_DIR") ?? path.join(process.cwd(), "langlearner-agents");
  },
  /** Kill a Claude Code call after this many milliseconds. */
  get CLAUDE_CODE_TIMEOUT_MS(): number {
    return parsed("CLAUDE_CODE_TIMEOUT_MS", z.coerce.number().int().min(5_000), 180_000);
  },
  /** Claude Code processes allowed at the same time (more calls wait their turn). */
  get CLAUDE_CODE_MAX_CONCURRENT(): number {
    return parsed("CLAUDE_CODE_MAX_CONCURRENT", z.coerce.number().int().min(1).max(8), 2);
  },
  get AI_MOCK(): boolean {
    return raw("AI_MOCK") === "1";
  },
  /** Dev-only auth bypass; always undefined in production. */
  get DEV_USER_ID(): string | undefined {
    if (process.env.NODE_ENV === "production") return undefined;
    const v = raw("DEV_USER_ID");
    if (v === undefined) return undefined;
    return parsed("DEV_USER_ID", z.uuid());
  },
  /**
   * No-login mode, production included: every visitor acts as this user id
   * and the login page is skipped. Meant for testing before the app is done.
   */
  get NO_LOGIN_USER_ID(): string | undefined {
    const v = raw("NO_LOGIN_USER_ID");
    if (v === undefined) return undefined;
    return parsed("NO_LOGIN_USER_ID", z.uuid());
  },
  /** The user id to act as without Supabase (dev bypass or no-login mode), if any. */
  get BYPASS_USER_ID(): string | undefined {
    return this.DEV_USER_ID ?? this.NO_LOGIN_USER_ID;
  },
};
