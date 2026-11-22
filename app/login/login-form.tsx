"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <p role="status" className="bg-good-soft rounded-xl p-3 text-sm">
        If this address is allowed, a login link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Label htmlFor="email">Email</Label>
      <Input id="email" name="email" type="email" autoComplete="email" required />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send magic link"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-wrong-text text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
