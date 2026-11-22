/** Errors raised by the AI layer. Messages are safe to show to the user. */

export class BudgetError extends Error {
  readonly kind = "budget" as const;
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}

export class AiError extends Error {
  readonly kind = "ai" as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiError";
  }
}

export type AiErrorPayload = { kind: "budget" | "ai"; message: string };

/** Serializable form for server actions / route handlers. */
export function toAiErrorPayload(error: unknown): AiErrorPayload {
  if (error instanceof BudgetError) return { kind: "budget", message: error.message };
  if (error instanceof AiError) return { kind: "ai", message: error.message };
  return { kind: "ai", message: "The AI request failed. Please try again." };
}
