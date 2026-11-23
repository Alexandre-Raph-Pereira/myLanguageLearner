import "server-only";
import { NextResponse } from "next/server";
import { toAiErrorPayload } from "@/lib/ai/errors";
import { UnauthorizedError } from "@/lib/auth";
import { getGrammarContext, type GrammarContext } from "./context";

export function errorJson(message: string, status: number) {
  return NextResponse.json({ error: { kind: "ai", message } }, { status });
}

/** Context for grammar route handlers, or a JSON 401. */
export async function routeContext(): Promise<GrammarContext | NextResponse> {
  try {
    return await getGrammarContext({ throwOnMissing: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return errorJson(e.message, 401);
    throw e;
  }
}

/** AI-layer error → `{ error }` (402 budget, 502 AI). */
export function aiErrorJson(e: unknown) {
  const error = toAiErrorPayload(e);
  return NextResponse.json({ error }, { status: error.kind === "budget" ? 402 : 502 });
}
