"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getGrammarContext } from "@/lib/grammar/context";
import { creditLesson } from "@/lib/grammar/credit";
import { deleteGrammar, getGrammar } from "@/lib/grammar/queries";

/** "Mark as studied today" → grammar_credit (+10, once per lesson per local day). */
export async function markStudiedAction(id: string): Promise<void> {
  const { db, scope } = await getGrammarContext({ throwOnMissing: true });
  const lesson = await getGrammar(db, scope, id);
  if (!lesson) return;
  await creditLesson(db, scope, id, "studied");
  revalidatePath(`/grammar/${id}`);
  revalidatePath("/grammar");
  revalidatePath("/");
}

export async function deleteGrammarAction(id: string): Promise<void> {
  const { db, scope } = await getGrammarContext({ throwOnMissing: true });
  await deleteGrammar(db, scope, id);
  revalidatePath("/grammar");
  redirect("/grammar");
}
