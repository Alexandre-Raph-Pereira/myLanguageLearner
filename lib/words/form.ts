import { wordInput, type WordInput } from "./input";

export type WordFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fields: Partial<Record<keyof WordInput, string>> };

export const WORD_FORM_IDLE: WordFormState = { status: "idle" };

/** Reads the word form (meanings = tags + the not-yet-added draft) and validates it. */
export function parseWordForm(
  fd: FormData,
): { ok: true; data: WordInput } | { ok: false; state: WordFormState } {
  const meanings = [...fd.getAll("meanings"), fd.get("meaningDraft") ?? ""]
    .map(String)
    .flatMap((m) => m.split(";"));
  const parsed = wordInput.safeParse({
    term: String(fd.get("term") ?? ""),
    meanings,
    type: String(fd.get("type") || "other"),
    exampleSentence: String(fd.get("exampleSentence") ?? ""),
    exampleTranslation: String(fd.get("exampleTranslation") ?? ""),
    notes: String(fd.get("notes") ?? ""),
  });
  if (parsed.success) return { ok: true, data: parsed.data };
  const fields: Partial<Record<keyof WordInput, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof WordInput;
    fields[key] ??= issue.message;
  }
  return {
    ok: false,
    state: { status: "error", message: "Please fix the highlighted fields.", fields },
  };
}
