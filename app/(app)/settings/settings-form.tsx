"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IDLE, type FormState } from "./form-state";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** Small wrapper: server action + submit button + inline saved/error status. */
export function SettingsForm({
  action,
  children,
  submitLabel = "Save",
  name,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  /** Accessible name of the form (used by e2e tests). */
  name: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  return (
    <form action={formAction} aria-label={name} className="flex flex-col gap-3">
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <span aria-live="polite" className="text-sm">
          {state.status === "saved" && <span className="text-muted-foreground">Saved</span>}
          {state.status === "error" && <span className="text-destructive">{state.message}</span>}
        </span>
      </div>
    </form>
  );
}
