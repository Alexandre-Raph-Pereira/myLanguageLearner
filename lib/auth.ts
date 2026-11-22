import "server-only";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { isEmailAllowed } from "@/lib/auth-rules";
import { env } from "@/lib/env";
import { ensureUserRows } from "@/lib/user-bootstrap";

export type AuthUser = { id: string; email: string };

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

const bootstrapped = new Set<string>();

/** The signed-in, allow-listed user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // DEV_USER_ID (dev only) or NO_LOGIN_USER_ID (no-login mode, any env).
  const bypassId = env.BYPASS_USER_ID;
  if (bypassId) return { id: bypassId, email: "dev@localhost" };

  const { createSupabaseServerClient, isSupabaseConfigured } =
    await import("@/lib/supabase/server");
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isEmailAllowed(user.email, env.ALLOWED_EMAILS)) return null;
  return { id: user.id, email: user.email };
}

/**
 * Returns the current user. Pages: redirects to /login when signed out.
 * Route handlers / server actions: pass `{ throwOnMissing: true }` to get an
 * UnauthorizedError (status 401) instead. Creates the user's rows on first call.
 */
export async function requireUser(opts: { throwOnMissing?: boolean } = {}): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    if (opts.throwOnMissing) throw new UnauthorizedError();
    redirect("/login");
  }
  if (!bootstrapped.has(user.id)) {
    await ensureUserRows(await getDb(), user.id);
    bootstrapped.add(user.id);
  }
  return user;
}
