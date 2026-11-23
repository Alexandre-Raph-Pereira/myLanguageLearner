import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_INSTRUCTION_CHARS, rewriteGrammar } from "@/lib/grammar/ai";
import { aiErrorJson, errorJson, routeContext } from "@/lib/grammar/http";
import { reviewDraftSchema } from "@/lib/grammar/schema";

export const maxDuration = 60;

const MAX_BODY_CHARS = 60_000;

const body = z.object({
  draft: reviewDraftSchema,
  instruction: z.string().max(MAX_INSTRUCTION_CHARS).nullish(),
});

/** One AI operation: `{ draft, instruction? }` → `{ draft }` (rewritten; related kept). */
export async function POST(req: Request) {
  const ctx = await routeContext();
  if (ctx instanceof NextResponse) return ctx;
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY_CHARS) return errorJson("This draft is too long to rewrite.", 413);
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // handled below
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return errorJson("Invalid draft.", 400);
  const instruction = parsed.data.instruction?.normalize("NFC").trim() || null;
  try {
    const draft = await rewriteGrammar(ctx.db, ctx.scope, parsed.data.draft, instruction);
    return NextResponse.json({ draft });
  } catch (e) {
    return aiErrorJson(e);
  }
}
