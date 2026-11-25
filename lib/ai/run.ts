import "server-only";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModelUsage,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";
import type { z } from "zod";
import { getDb } from "@/db";
import { aiUsage } from "@/db/schema";
import type { Db } from "@/db/types";
import type { Language } from "@/lib/languages";
import { getUserSettings } from "@/lib/settings";
import { assertBudget, assertCallCap, type Operation } from "./budget";
import { AiError, BudgetError } from "./errors";
import { estimateCost, estimateInputTokens } from "./estimate";
import { costOf, getPricing, type PricingRates, type TokenUsage } from "./pricing";
import { getModel, isPlanProvider, type ModelChoice, type Tier } from "./providers";

export type AiImage = { data: Uint8Array | string; mediaType: string };

type PromptInput =
  { prompt: string; messages?: never } | { messages: ModelMessage[]; prompt?: never };

export type AiCallOptions = PromptInput & {
  userId: string;
  operation: Operation;
  /** Task name, e.g. `words.photo_extract` (also the mock fixture name). */
  task: string;
  /** Target language of the call (picks language-specific agents skills); default `ko`. */
  language?: Language;
  tier: Tier;
  system: string;
  images?: AiImage[];
  maxOutputTokens: number;
  /** Anthropic prompt caching on the system message (ignored by other providers). */
  cacheSystem?: boolean;
  /** Injected in tests; defaults to the app database. */
  db?: Db;
};

export type AiObjectOptions<S extends z.ZodType> = AiCallOptions & { schema: S };

type Ctx = {
  db: Db;
  opts: AiCallOptions;
  choice: ModelChoice;
  model: ReturnType<typeof getModel>["model"];
  providerLabel: string;
  pricing: PricingRates;
  /** Plan provider (claude-code): no prices, a daily call cap instead of dollar budgets. */
  plan: boolean;
  caps: {
    budgetPerRequestUsd: number;
    budgetMonthlyUsd: number;
    aiCallsDailyCap: number;
    timezone: string;
  };
};

const FREE: PricingRates = { inputPerMtok: 0, outputPerMtok: 0, cacheReadPerMtok: 0 };

const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };

function toTokenUsage(u: LanguageModelUsage | undefined): TokenUsage {
  if (!u) return ZERO_USAGE;
  return {
    inputTokens: u.inputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
    cachedInputTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

function messagesText(messages: ModelMessage[]): string {
  return messages
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : m.content
            .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
            .join("\n"),
    )
    .join("\n");
}

function buildMessages(opts: AiCallOptions): ModelMessage[] {
  const images = opts.images ?? [];
  if (opts.messages) {
    if (images.length === 0) return opts.messages;
    return [
      ...opts.messages,
      {
        role: "user",
        content: images.map((img) => ({ type: "file", data: img.data, mediaType: img.mediaType })),
      },
    ];
  }
  if (images.length === 0) return [{ role: "user", content: opts.prompt }];
  return [
    {
      role: "user",
      content: [
        { type: "text", text: opts.prompt },
        ...images.map((img) => ({
          type: "file" as const,
          data: img.data,
          mediaType: img.mediaType,
        })),
      ],
    },
  ];
}

function instructionsFor(ctx: Ctx): string | SystemModelMessage {
  if (ctx.opts.cacheSystem && ctx.choice.provider === "anthropic") {
    return {
      role: "system",
      content: ctx.opts.system,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    };
  }
  return ctx.opts.system;
}

async function logUsage(
  ctx: Pick<Ctx, "db" | "opts" | "choice" | "providerLabel">,
  row: {
    status: "ok" | "error" | "blocked";
    usage?: TokenUsage;
    estimated: number;
    cost: number;
    error?: string;
  },
) {
  const usage = row.usage ?? ZERO_USAGE;
  await ctx.db.insert(aiUsage).values({
    userId: ctx.opts.userId,
    operationId: ctx.opts.operation.id,
    task: ctx.opts.task,
    provider: ctx.providerLabel,
    model: ctx.choice.modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    estimatedCostUsd: row.estimated,
    costUsd: row.cost,
    status: row.status,
    error: row.error?.slice(0, 2000) ?? null,
  });
}

async function prepare(opts: AiCallOptions): Promise<Ctx> {
  if (opts.operation.userId !== opts.userId) {
    throw new AiError("Operation belongs to another user.");
  }
  const db = opts.db ?? (await getDb());
  const settings = await getUserSettings(db, opts.userId);
  const { model, choice, mock } = getModel(opts.tier, settings, opts.task, opts.language);
  const providerLabel = mock ? `mock:${choice.provider}` : choice.provider;
  const plan = isPlanProvider(choice.provider);
  const pricing = plan ? FREE : await getPricing(db, choice.modelId);
  if (!pricing) {
    const message = `No pricing for model ${choice.modelId}. Add its prices in Settings.`;
    await logUsage(
      { db, opts, choice, providerLabel },
      { status: "blocked", estimated: 0, cost: 0, error: message },
    );
    throw new BudgetError(message);
  }
  return {
    db,
    opts,
    choice,
    model,
    providerLabel,
    pricing,
    plan,
    caps: {
      budgetPerRequestUsd: settings.budgetPerRequestUsd,
      budgetMonthlyUsd: settings.budgetMonthlyUsd,
      aiCallsDailyCap: settings.aiCallsDailyCap,
      timezone: settings.timezone,
    },
  };
}

/** Budget check for one model call; logs a `blocked` row when refused. */
async function guard(ctx: Ctx, messages: ModelMessage[]): Promise<number> {
  if (ctx.plan) {
    try {
      await assertCallCap(ctx.db, ctx.opts.userId, ctx.providerLabel, ctx.caps);
    } catch (e) {
      if (e instanceof BudgetError) {
        await logUsage(ctx, { status: "blocked", estimated: 0, cost: 0, error: e.message });
      }
      throw e;
    }
    return 0;
  }
  const inputTokens = estimateInputTokens({
    text: `${ctx.opts.system}\n${messagesText(messages)}`,
    images: ctx.opts.images?.length ?? 0,
  });
  const estimated = estimateCost(inputTokens, ctx.opts.maxOutputTokens, ctx.pricing);
  try {
    await assertBudget(ctx.db, ctx.opts.operation, estimated, ctx.caps);
  } catch (e) {
    if (e instanceof BudgetError) {
      await logUsage(ctx, { status: "blocked", estimated, cost: 0, error: e.message });
    }
    throw e;
  }
  return estimated;
}

function record(ctx: Ctx, estimated: number, usage: TokenUsage): number {
  const cost = costOf(usage, ctx.pricing);
  ctx.opts.operation.spentEstimate += estimated;
  ctx.opts.operation.spentActual += cost;
  return cost;
}

function providerFailure(e: unknown): AiError {
  // Errors raised by our own adapters (claude-code) already carry a user-facing message.
  if (e instanceof AiError) return e;
  return new AiError("The AI provider request failed. Please try again.", { cause: e });
}

/**
 * Structured AI call: budget-checked, zod-validated, logged in ai_usage.
 * On a schema/JSON failure the call is retried once with the validation error.
 */
export async function aiObject<S extends z.ZodType>(opts: AiObjectOptions<S>): Promise<z.infer<S>> {
  const ctx = await prepare(opts);
  let messages = buildMessages(opts);

  for (let attempt = 0; attempt < 2; attempt++) {
    const estimated = await guard(ctx, messages);
    try {
      const result = await generateText({
        model: ctx.model,
        instructions: instructionsFor(ctx),
        messages,
        output: Output.object({ schema: opts.schema }),
        maxOutputTokens: opts.maxOutputTokens,
      });
      const usage = toTokenUsage(result.usage);
      const cost = record(ctx, estimated, usage);
      await logUsage(ctx, { status: "ok", usage, estimated, cost });
      return result.output as z.infer<S>;
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) {
        const usage = toTokenUsage(e.usage);
        const cost = record(ctx, estimated, usage);
        const detail = e.cause instanceof Error ? e.cause.message : e.message;
        await logUsage(ctx, {
          status: "error",
          usage,
          estimated,
          cost,
          error: `invalid output: ${detail}`,
        });
        if (attempt === 0) {
          messages = [
            ...messages,
            { role: "assistant", content: e.text ?? "" },
            {
              role: "user",
              content: `Your previous answer was not valid for the required JSON schema.\nValidation error: ${detail}\nAnswer again with only valid JSON matching the schema.`,
            },
          ];
          continue;
        }
        throw new AiError("The AI returned an invalid answer twice. Please try again.", {
          cause: e,
        });
      }
      await logUsage(ctx, {
        status: "error",
        estimated,
        cost: 0,
        error: e instanceof Error ? e.message : String(e),
      });
      throw providerFailure(e);
    }
  }
  throw new AiError("Unreachable");
}

/** Plain-text AI call (e.g. grading feedback): budget-checked and logged. */
export async function aiText(opts: AiCallOptions): Promise<string> {
  const ctx = await prepare(opts);
  const messages = buildMessages(opts);
  const estimated = await guard(ctx, messages);
  try {
    const result = await generateText({
      model: ctx.model,
      instructions: instructionsFor(ctx),
      messages,
      maxOutputTokens: opts.maxOutputTokens,
    });
    const usage = toTokenUsage(result.usage);
    const cost = record(ctx, estimated, usage);
    await logUsage(ctx, { status: "ok", usage, estimated, cost });
    return result.text;
  } catch (e) {
    await logUsage(ctx, {
      status: "error",
      estimated,
      cost: 0,
      error: e instanceof Error ? e.message : String(e),
    });
    throw providerFailure(e);
  }
}
