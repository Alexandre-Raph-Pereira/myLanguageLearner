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
  if (!env.MAGIC_LINK_LOGIN) {
    return { status: "error", message: "Login by email link is turned off." };
  }
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Login is not configured (Supabase env vars missing)." };
  }
  const email = parsed.data.email.trim().toLowerCase();
  // Same response whether or not the address is allowed: don't leak the allow-list.
  const allowed = env.ALLOWED_EMAILS;
  if (!isEmailAllowed(email, allowed)) {
    // Server log only (Vercel → Logs), so the owner can diagnose a missing link.
    console.warn(
      `[login] ${maskEmail(email)} is not in ALLOWED_EMAILS (${allowed.length} entr${allowed.length === 1 ? "y" : "ies"} configured); no link sent.`,
    );
    return { status: "sent" };
  }
  const supabase = await createSupabaseServerClient();
  const callback = new URL("/auth/callback", await requestOrigin());
  callback.searchParams.set("next", safeNextPath(parsed.data.next));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });
  if (error) {
    console.error(`[login] Supabase refused to send the link: ${error.message}`);
    return { status: "error", message: error.message };
  }
  console.info(`[login] magic link requested for ${maskEmail(email)}, redirect ${callback.origin}`);
  return { status: "sent" };
}

/** "someone@example.com" → "so***@example.com" (enough to spot a typo, not the full address). */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}
