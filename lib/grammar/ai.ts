import "server-only";
import type { Db } from "@/db/types";
import { createOperation, type Operation } from "@/lib/ai/budget";
import { estimateInputTokens } from "@/lib/ai/estimate";
import { getPricing } from "@/lib/ai/pricing";
import {
  grammarRewritePrompt,
  grammarStructurePrompt,
  type GrammarPromptCtx,
} from "@/lib/ai/prompts/grammar";
import { isPlanProvider, resolveModelChoice } from "@/lib/ai/providers";
import { aiObject, type AiImage } from "@/lib/ai/run";
import { isLanguage, LANGUAGE_LABELS } from "@/lib/languages";
import { getLanguageProfile, getUserSettings } from "@/lib/settings";
import type { GrammarCostInfo } from "./cost";
import { draftForRewrite, normalizeDraft, toReviewDraft } from "./drafts";
import { compactListForPrompt, type Scope } from "./queries";
import { grammarDraftSchema, structureOutputSchema, type ReviewDraft } from "./schema";

export const STRUCTURE_TASK = "grammar.structure";
export const REWRITE_TASK = "grammar.rewrite";
export const STRUCTURE_MAX_OUTPUT = 8000;
export const REWRITE_MAX_OUTPUT = 4000;
export const MAX_NOTES_CHARS = 20_000;
export const MAX_INSTRUCTION_CHARS = 500;

async function promptCtx(db: Db, s: Scope): Promise<GrammarPromptCtx> {
  const settings = await getUserSettings(db, s.userId);
  const profile = await getLanguageProfile(db, s.userId, s.language);
  const native = isLanguage(settings.nativeLanguage)
    ? LANGUAGE_LABELS[settings.nativeLanguage].english
    : "English";
  return {
    language: s.language,
    nativeLanguage: native,
    targetLevel: profile?.targetLevel ?? null,
  };
}

export async function grammarCostInfo(db: Db, s: Scope): Promise<GrammarCostInfo> {
  const settings = await getUserSettings(db, s.userId);
  const { modelId, provider } = resolveModelChoice("smart", settings);
  const included = isPlanProvider(provider);
  const pricing = included ? null : await getPricing(db, modelId);
  const ctx = await promptCtx(db, s);
  const lessons = await compactListForPrompt(db, s);
  const sp = grammarStructurePrompt(ctx, lessons, { notes: "" });
  const rp = grammarRewritePrompt(ctx, "", null);
  return {
    model: modelId,
    included,
    rates: included
      ? { inputPerMtok: 0, outputPerMtok: 0 }
      : pricing
        ? { inputPerMtok: pricing.inputPerMtok, outputPerMtok: pricing.outputPerMtok }
        : null,
    structureBaseTokens: estimateInputTokens({ text: `${sp.system}\n${sp.prompt}` }),
    rewriteBaseTokens: estimateInputTokens({ text: `${rp.system}\n${rp.prompt}` }),
    structureMaxOutput: STRUCTURE_MAX_OUTPUT,
    rewriteMaxOutput: REWRITE_MAX_OUTPUT,
  };
}

/** `grammar.structure`: notes text **or** one image → review drafts (related codes resolved). */
export async function structureGrammar(
  db: Db,
  s: Scope,
  input: { notes: string } | { image: AiImage },
  operation: Operation = createOperation(s.userId, STRUCTURE_TASK),
): Promise<ReviewDraft[]> {
  const ctx = await promptCtx(db, s);
  const lessons = await compactListForPrompt(db, s);
  const isImage = "image" in input;
  const p = grammarStructurePrompt(
    ctx,
    lessons,
    isImage ? { image: true } : { notes: input.notes },
  );
  const res = await aiObject({
    db,
    userId: s.userId,
    operation,
    task: STRUCTURE_TASK,
    tier: "smart",
    schema: structureOutputSchema,
    system: p.system,
    prompt: p.prompt,
    images: isImage ? [input.image] : undefined,
    maxOutputTokens: STRUCTURE_MAX_OUTPUT,
    cacheSystem: true,
  });
  return res.drafts.map((d) => toReviewDraft(d, lessons)).filter((d) => d.title || d.pattern);
}

/** `grammar.rewrite`: one draft + optional instruction → one draft. `related` is kept as given. */
export async function rewriteGrammar(
  db: Db,
  s: Scope,
  draft: ReviewDraft,
  instruction: string | null,
): Promise<ReviewDraft> {
  const ctx = await promptCtx(db, s);
  const p = grammarRewritePrompt(ctx, draftForRewrite(draft), instruction);
  const res = await aiObject({
    db,
    userId: s.userId,
    operation: createOperation(s.userId, REWRITE_TASK),
    task: REWRITE_TASK,
    tier: "smart",
    schema: grammarDraftSchema,
    system: p.system,
    prompt: p.prompt,
    maxOutputTokens: REWRITE_MAX_OUTPUT,
    cacheSystem: true,
  });
  const { related: _ignored, ...rest } = res;
  void _ignored;
  return { ...normalizeDraft(rest), related: draft.related };
}
