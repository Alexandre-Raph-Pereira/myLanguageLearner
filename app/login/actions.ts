"use server";

import { z } from "zod";
import { isEmailAllowed, safeNextPath } from "@/lib/auth-rules";
import { env } from "@/lib/env";
import { requestOrigin } from "@/lib/request-origin";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const schema = z.object({ email: z.email(), next: z.string().optional() });

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Login is not configured (Supabase env vars missing)." };
  }
  const email = parsed.data.email.trim().toLowerCase();
  // Same response whether or not the address is allowed: don't leak the allow-list.
  if (!isEmailAllowed(email, env.ALLOWED_EMAILS)) {
    return { status: "sent" };
  }
  const supabase = await createSupabaseServerClient();
  const callback = new URL("/auth/callback", await requestOrigin());
  callback.searchParams.set("next", safeNextPath(parsed.data.next));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent" };
}
