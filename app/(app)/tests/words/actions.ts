"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WORD_TYPES } from "@/db/schema/words";
import { getWordContext } from "@/lib/words/context";
import {
  answerWord,
  NoWordsError,
  overrideAnswer,
  SessionError,
  startRetry,
  startWordTest,
  wordTestConfig,
  type AnswerOutcome,
} from "@/lib/words/session";

export type StartState = { error?: string };

export async function startWordTestAction(_: StartState, fd: FormData): Promise<StartState> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  const parsed = wordTestConfig.safeParse({
    types: fd.getAll("types").filter((t) => (WORD_TYPES as readonly unknown[]).includes(t)),
    direction: fd.get("direction") ?? undefined,
    count: fd.get("count") ?? undefined,
    includeNoExample: fd.get("includeNoExample") === "on",
  });
  if (!parsed.success) return { error: "Choose between 5 and 50 words." };
  let id: string;
  try {
    id = (await startWordTest(db, scope, parsed.data)).id;
  } catch (e) {
    if (e instanceof NoWordsError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/tests/words/${id}`);
}

export async function retryMissedAction(sessionId: string): Promise<void> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  const s = await startRetry(db, scope, sessionId);
  revalidatePath("/", "layout");
  redirect(`/tests/words/${s.id}`);
}

export type AnswerResponse = { ok: true; outcome: AnswerOutcome } | { ok: false; error: string };

async function guarded(fn: () => Promise<AnswerOutcome>): Promise<AnswerResponse> {
  try {
    return { ok: true, outcome: await fn() };
  } catch (e) {
    if (e instanceof SessionError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function answerWordAction(
  sessionId: string,
  index: number,
  answer: string,
): Promise<AnswerResponse> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  return guarded(() =>
    answerWord(db, scope, { sessionId, index: Math.floor(index), answer: String(answer) }),
  );
}

export async function overrideAnswerAction(
  sessionId: string,
  index: number,
  addMeaning: boolean,
): Promise<AnswerResponse> {
  const { db, scope } = await getWordContext({ throwOnMissing: true });
  return guarded(() =>
    overrideAnswer(db, scope, { sessionId, index: Math.floor(index), addMeaning: !!addMeaning }),
  );
}
