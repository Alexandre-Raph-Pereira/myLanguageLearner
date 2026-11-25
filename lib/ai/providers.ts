import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { env, type AiProviderName } from "@/lib/env";
import type { Language } from "@/lib/languages";
import { createClaudeCodeModel } from "./claude-code/model";
import { createMockModel } from "./mock";

export type Tier = "smart" | "fast";
export const AI_PROVIDERS = [
  "claude-code",
  "anthropic",
  "openai",
  "google",
] as const satisfies AiProviderName[];

export const AI_PROVIDER_LABELS: Record<AiProviderName, string> = {
  "claude-code": "Claude Code (this computer, your Claude plan)",
  anthropic: "Anthropic API",
  openai: "OpenAI API",
  google: "Google API",
};

/** Providers billed by a subscription instead of per token: no prices, a daily call cap. */
export function isPlanProvider(provider: AiProviderName): boolean {
  return provider === "claude-code";
}

/** Per-user overrides from user_settings (null → env defaults). */
export type ModelSettings = {
  aiProvider: string | null;
  aiModelSmart: string | null;
  aiModelFast: string | null;
};

export type ModelChoice = { provider: AiProviderName; modelId: string };

function isProvider(v: string | null): v is AiProviderName {
  return v !== null && (AI_PROVIDERS as readonly string[]).includes(v);
}

export function resolveModelChoice(tier: Tier, settings?: ModelSettings | null): ModelChoice {
  const provider = isProvider(settings?.aiProvider ?? null)
    ? (settings!.aiProvider as AiProviderName)
    : env.AI_PROVIDER;
  const override = tier === "smart" ? settings?.aiModelSmart : settings?.aiModelFast;
  const modelId = override?.trim() || (tier === "smart" ? env.AI_MODEL_SMART : env.AI_MODEL_FAST);
  return { provider, modelId };
}

function providerModel(
  { provider, modelId }: ModelChoice,
  task: string,
  language: Language,
): LanguageModel {
  switch (provider) {
    case "claude-code":
      return createClaudeCodeModel(modelId, task, language);
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(modelId);
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId);
  }
}

/**
 * The AI SDK model for a tier. With AI_MOCK=1 returns a mock model answering
 * from tests/fixtures/ai/<task>.json (task is required then).
 */
export function getModel(
  tier: Tier,
  settings?: ModelSettings | null,
  task = "default",
  language: Language = "ko",
): { model: LanguageModel; choice: ModelChoice; mock: boolean } {
  const choice = resolveModelChoice(tier, settings);
  if (env.AI_MOCK) return { model: createMockModel(task, choice.modelId), choice, mock: true };
  return { model: providerModel(choice, task, language), choice, mock: false };
}
