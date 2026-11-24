import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/types";
import { claudeCodeStatus } from "@/lib/ai/claude-code/status";
import { env, type AiProviderName } from "@/lib/env";

export type Health = {
  ok: boolean;
  /** Git commit of the build (APP_COMMIT, set by scripts/home/deploy.sh), else "dev". */
  version: string;
  db: "ok" | "error";
  ai: { provider: AiProviderName | "mock"; ready: boolean };
};

const KEY_OF: Record<Exclude<AiProviderName, "claude-code">, () => string> = {
  anthropic: () => env.ANTHROPIC_API_KEY,
  openai: () => env.OPENAI_API_KEY,
  google: () => env.GOOGLE_GENERATIVE_AI_API_KEY,
};

/** Server default provider ready? Never returns key values or user data. */
async function aiHealth(): Promise<Health["ai"]> {
  if (env.AI_MOCK) return { provider: "mock", ready: true };
  let provider: AiProviderName;
  try {
    provider = env.AI_PROVIDER;
  } catch {
    return { provider: "anthropic", ready: false };
  }
  if (provider === "claude-code") return { provider, ready: (await claudeCodeStatus()).ready };
  try {
    return { provider, ready: KEY_OF[provider]().length > 0 };
  } catch {
    return { provider, ready: false };
  }
}

/** `ok` = the database answers. AI readiness is reported but does not fail the check. */
export async function checkHealth(getDb: () => Promise<Db>): Promise<Health> {
  let db: Health["db"] = "error";
  try {
    await (await getDb()).execute(sql`select 1`);
    db = "ok";
  } catch {
    db = "error";
  }
  return {
    ok: db === "ok",
    version: process.env.APP_COMMIT || "dev",
    db,
    ai: await aiHealth(),
  };
}
