import { NextResponse } from "next/server";
import { MAX_NOTES_CHARS, structureGrammar } from "@/lib/grammar/ai";
import { aiErrorJson, errorJson, routeContext } from "@/lib/grammar/http";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/words/photo";

export const maxDuration = 60;

/**
 * One AI operation: JSON `{ notes }` or multipart `image` (one notebook photo) →
 * `{ drafts }` (review drafts, related lessons resolved). Nothing is stored.
 */
export async function POST(req: Request) {
  const ctx = await routeContext();
  if (ctx instanceof NextResponse) return ctx;

  let input: { notes: string } | { image: { data: Uint8Array; mediaType: string } };
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof Blob) || file.size === 0) {
      return errorJson("Send one image in the `image` field.", 400);
    }
    if (!IMAGE_TYPES.includes(file.type)) return errorJson("Unsupported image type.", 415);
    if (file.size > MAX_IMAGE_BYTES) return errorJson("Image too large (max 4 MB).", 413);
    input = { image: { data: new Uint8Array(await file.arrayBuffer()), mediaType: file.type } };
  } else {
    const body = (await req.json().catch(() => null)) as { notes?: unknown } | null;
    const notes = typeof body?.notes === "string" ? body.notes.normalize("NFC").trim() : "";
    if (!notes) return errorJson("Paste some notes first.", 400);
    if (notes.length > MAX_NOTES_CHARS) {
      return errorJson(
        `Notes are too long (max ${MAX_NOTES_CHARS.toLocaleString("en-US")} characters).`,
        413,
      );
    }
    input = { notes };
  }

  try {
    const drafts = await structureGrammar(ctx.db, ctx.scope, input);
    return NextResponse.json({ drafts });
  } catch (e) {
    return aiErrorJson(e);
  }
}
