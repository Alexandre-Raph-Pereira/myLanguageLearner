"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WORD_TYPES } from "@/db/schema/words";
import { toAiErrorPayload, type AiErrorPayload } from "@/lib/ai/errors";
import { getWordContext } from "@/lib/words/context";
import { wordInput, type WordInput } from "@/lib/words/input";
import { bulkInsert, findDuplicates, type BulkResult } from "@/lib/words/queries";
import { estimateSuggestTypes, suggestTypes } from "@/lib/words/suggest-types";

const MAX_ROWS = 5000;

const keyRows = z
  .array(z.object({ term: z.string().max(500), meanings: z.array(z.string().max(500)).max(50) }))
  .max(MAX_ROWS);

/** Keys (term + primary meaning) of these rows that already exist in the bank. */
export async function findExistingAction(rows: { term: string; meanings: string[] }[]) {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  const parsed = keyRows.parse(rows);
  return [...(await findDuplicates(db, scope, parsed))];
}

const suggestRows = z
  .array(z.object({ i: z.number().int(), term: z.string().max(200), meaning: z.string().max(200) }))
  .max(MAX_ROWS);

export async function estimateSuggestTypesAction(
  rows: { i: number; term: string; meaning: string }[],
) {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  return estimateSuggestTypes(db, scope, suggestRows.parse(rows));
}

export async function suggestTypesAction(
  rows: { i: number; term: string; meaning: string }[],
): Promise<
  | { ok: true; types: { i: number; type: (typeof WORD_TYPES)[number] }[] }
  | { ok: false; error: AiErrorPayload }
> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  try {
    return { ok: true, types: await suggestTypes(db, scope, suggestRows.parse(rows)) };
  } catch (e) {
    return { ok: false, error: toAiErrorPayload(e) };
  }
}

export type ImportPayloadRow = {
  term: string;
  meanings: string[];
  type: string;
  exampleSentence: string | null;
  exampleTranslation: string | null;
};

/** Validates every row again (zod) and inserts in one transaction, batches of 500. */
export async function importWordsAction(
  rows: ImportPayloadRow[],
  opts: { updateExisting: boolean; source: "import_csv" | "import_photo" },
): Promise<BulkResult & { invalid: number }> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new Error("Too many rows.");
  const source = opts.source === "import_photo" ? "import_photo" : "import_csv";
  const valid: WordInput[] = [];
  let invalid = 0;
  for (const r of rows) {
    const parsed = wordInput.safeParse(r);
    if (parsed.success) valid.push(parsed.data);
    else invalid++;
  }
  const result = await bulkInsert(db, scope, valid, {
    source,
    updateExisting: !!opts.updateExisting,
  });
  revalidatePath("/words");
  revalidatePath("/", "layout");
  return { ...result, skipped: result.skipped + invalid, invalid };
}
