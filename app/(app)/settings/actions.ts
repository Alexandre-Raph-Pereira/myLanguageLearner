"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import {
  aiSettingsInput,
  budgetsInput,
  languageProfileInput,
  pricingInput,
  saveAiSettings,
  saveBudgets,
  saveLanguageProfile,
  savePricing,
} from "@/lib/settings";
import type { FormState } from "./form-state";

async function handle<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  save: (userId: string, input: z.infer<S>) => Promise<void>,
): Promise<FormState> {
  const user = await requireUser({ throwOnMissing: true });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: `${issue?.path.join(".") || "input"}: ${issue?.message}` };
  }
  await save(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { status: "saved", at: Date.now() };
}

export async function saveLanguageProfileAction(_: FormState, formData: FormData) {
  return handle(languageProfileInput, formData, async (userId, input) =>
    saveLanguageProfile(await getDb(), userId, input),
  );
}

export async function saveAiSettingsAction(_: FormState, formData: FormData) {
  return handle(aiSettingsInput, formData, async (userId, input) =>
    saveAiSettings(await getDb(), userId, input),
  );
}

export async function saveBudgetsAction(_: FormState, formData: FormData) {
  return handle(budgetsInput, formData, async (userId, input) =>
    saveBudgets(await getDb(), userId, input),
  );
}

export async function savePricingAction(_: FormState, formData: FormData) {
  return handle(pricingInput, formData, async (_userId, input) =>
    savePricing(await getDb(), input),
  );
}
