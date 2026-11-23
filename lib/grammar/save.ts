import "server-only";
import { z } from "zod";
import type { Db } from "@/db/types";
import { creditLesson } from "./credit";
import { fieldErrors, toGrammarInputRaw } from "./drafts";
import { createGrammar, findDuplicateLessons, updateGrammar, type Scope } from "./queries";
import { grammarInput, reviewDraftSchema } from "./schema";

export const SAVE_SOURCES = ["manual", "import_text", "import_photo"] as const;
export type SaveSource = (typeof SAVE_SOURCES)[number];

export const saveRequest = z.object({
  draft: reviewDraftSchema,
  source: z.enum(SAVE_SOURCES),
  /** Set when editing an existing lesson. */
  lessonId: z.uuid().nullish(),
  allowDuplicate: z.boolean().default(false),
});
export type SaveRequest = z.input<typeof saveRequest>;

export type SaveResult =
  | { status: "saved"; id: string; title: string; created: boolean }
  | { status: "duplicate"; duplicates: { id: string; title: string }[] }
  | { status: "invalid"; message: string; errors: Record<string, string> }
  | { status: "missing" };

/**
 * Validates and stores a reviewed draft. New lessons are credited for today's grammar
 * goal (`grammar_credit`, reason `saved`). Possible duplicates block the save unless
 * `allowDuplicate` ("save anyway").
 */
export async function saveDraft(db: Db, s: Scope, raw: SaveRequest): Promise<SaveResult> {
  const req = saveRequest.safeParse(raw);
  if (!req.success) return { status: "invalid", message: "Invalid draft.", errors: {} };
  const parsed = grammarInput.safeParse(toGrammarInputRaw(req.data.draft));
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields.",
      errors: fieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;
  const lessonId = req.data.lessonId ?? undefined;
  if (!req.data.allowDuplicate) {
    const dups = await findDuplicateLessons(db, s, input, lessonId);
    if (dups.length > 0) {
      return { status: "duplicate", duplicates: dups.map((d) => ({ id: d.id, title: d.title })) };
    }
  }
  if (lessonId) {
    const row = await updateGrammar(db, s, lessonId, input);
    if (!row) return { status: "missing" };
    return { status: "saved", id: row.id, title: row.title, created: false };
  }
  const row = await createGrammar(db, s, input, req.data.source);
  await creditLesson(db, s, row.id, "saved");
  return { status: "saved", id: row.id, title: row.title, created: true };
}
