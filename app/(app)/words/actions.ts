"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWordContext } from "@/lib/words/context";
import { parseWordForm, type WordFormState } from "@/lib/words/form";
import {
  createWord,
  deleteWord,
  DuplicateWordError,
  getWord,
  patchSchedule,
  updateWord,
} from "@/lib/words/queries";
import { resetToZero, scheduleOf } from "@/lib/words/scheduler";

function duplicateState(): WordFormState {
  return {
    status: "error",
    message: "This word already exists with the same primary meaning.",
    fields: { meanings: "Same term + primary meaning already in your bank" },
  };
}

export async function createWordAction(_: WordFormState, fd: FormData): Promise<WordFormState> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  const parsed = parseWordForm(fd);
  if (!parsed.ok) return parsed.state;
  try {
    await createWord(db, scope, parsed.data);
  } catch (e) {
    if (e instanceof DuplicateWordError) return duplicateState();
    throw e;
  }
  revalidatePath("/words");
  redirect(fd.get("addAnother") ? "/words/new?added=1" : "/words");
}

export async function updateWordAction(
  id: string,
  _: WordFormState,
  fd: FormData,
): Promise<WordFormState> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  const parsed = parseWordForm(fd);
  if (!parsed.ok) return parsed.state;
  try {
    const row = await updateWord(db, scope, id, parsed.data);
    if (!row) return { status: "error", message: "Word not found.", fields: {} };
  } catch (e) {
    if (e instanceof DuplicateWordError) return duplicateState();
    throw e;
  }
  revalidatePath("/words");
  redirect("/words");
}

export async function deleteWordAction(id: string): Promise<void> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  await deleteWord(db, scope, id);
  revalidatePath("/words");
  redirect("/words");
}

export async function resetWordLevelAction(id: string): Promise<void> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  const word = await getWord(db, scope, id);
  if (!word) return;
  await patchSchedule(db, scope, id, resetToZero(scheduleOf(word), new Date(), "manual"));
  revalidatePath(`/words/${id}`);
  revalidatePath("/words");
}
