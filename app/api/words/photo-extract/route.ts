import { NextResponse } from "next/server";
import { toAiErrorPayload } from "@/lib/ai/errors";
import { UnauthorizedError } from "@/lib/auth";
import { getWordContext } from "@/lib/words/context";
import { extractFromPhoto, IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/words/photo";

export const maxDuration = 60;

/** POST multipart `image` (one per request) → `{ entries }`. Images are never stored. */
export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await getWordContext({ throwOnMissing: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: { kind: "ai", message: e.message } }, { status: 401 });
    }
    throw e;
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { error: { kind: "ai", message: "Send one image in the `image` field." } },
      { status: 400 },
    );
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: { kind: "ai", message: "Unsupported image type." } },
      { status: 415 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: { kind: "ai", message: "Image too large (max 4 MB)." } },
      { status: 413 },
    );
  }
  try {
    const entries = await extractFromPhoto(ctx.db, ctx.scope, {
      data: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type,
    });
    return NextResponse.json({ entries });
  } catch (e) {
    const error = toAiErrorPayload(e);
    return NextResponse.json({ error }, { status: error.kind === "budget" ? 402 : 502 });
  }
}
