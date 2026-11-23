import "server-only";
import { z } from "zod";
import { WORD_TYPES } from "@/db/schema/words";
import type { Db } from "@/db/types";
import { createOperation } from "@/lib/ai/budget";
import { photoExtractPrompt } from "@/lib/ai/prompts/words-photo-extract";
import { aiObject } from "@/lib/ai/run";
import type { Scope } from "./queries";

export const PHOTO_TASK = "words.photo_extract";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"];

export const photoExtractSchema = z.object({
  entries: z.array(
    z.object({
      term: z.string(),
      meanings: z.array(z.string()),
      example_sentence: z.string().nullish(),
      example_translation: z.string().nullish(),
      type: z.enum(WORD_TYPES).nullish(),
      confidence: z.enum(["high", "low"]),
    }),
  ),
});
import type { PhotoEntry } from "./import";

export type { PhotoEntry };

/** One image per call (smart tier, vision). The image is not stored. */
export async function extractFromPhoto(
  db: Db,
  s: Scope,
  image: { data: Uint8Array; mediaType: string },
): Promise<PhotoEntry[]> {
  const p = photoExtractPrompt(s.language);
  const res = await aiObject({
    db,
    userId: s.userId,
    operation: createOperation(s.userId, "words.photo_extract"),
    task: PHOTO_TASK,
    tier: "smart",
    schema: photoExtractSchema,
    system: p.system,
    prompt: p.prompt,
    images: [image],
    maxOutputTokens: 4000,
    cacheSystem: true,
  });
  return res.entries;
}
