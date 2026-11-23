"use server";

import { revalidatePath } from "next/cache";
import { getGrammarContext } from "@/lib/grammar/context";
import { saveDraft, type SaveRequest, type SaveResult } from "@/lib/grammar/save";

/** Save one reviewed draft (create or update). Nothing is stored without this explicit call. */
export async function saveGrammarDraftAction(req: SaveRequest): Promise<SaveResult> {
  const { db, scope } = await getGrammarContext({ throwOnMissing: true });
  const result = await saveDraft(db, scope, req);
  if (result.status === "saved") {
    revalidatePath("/grammar");
    revalidatePath(`/grammar/${result.id}`);
    revalidatePath("/");
  }
  return result;
}
