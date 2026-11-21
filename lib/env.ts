import { z } from "zod";

/**
 * Lazily validated environment. Nothing is read at import time, so builds and
 * tests run without a full env; a missing/invalid variable throws a clear error
 * only when its getter is used.
 */

const providerSchema = z.enum(["anthropic", "openai", "google"]);
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
};
