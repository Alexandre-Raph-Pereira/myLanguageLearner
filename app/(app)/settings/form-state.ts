export type FormState =
  { status: "idle" } | { status: "saved"; at: number } | { status: "error"; message: string };

export const IDLE: FormState = { status: "idle" };
