import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { env, type AiProviderName } from "@/lib/env";
import { createMockModel } from "./mock";

export type Tier = "smart" | "fast";
export const AI_PROVIDERS = ["anthropic", "openai", "google"] as const satisfies AiProviderName[];

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

function providerModel({ provider, modelId }: ModelChoice): LanguageModel {
  switch (provider) {
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
): { model: LanguageModel; choice: ModelChoice; mock: boolean } {
  const choice = resolveModelChoice(tier, settings);
  if (env.AI_MOCK) return { model: createMockModel(task, choice.modelId), choice, mock: true };
  return { model: providerModel(choice), choice, mock: false };
}
