import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, safeNextPath } from "@/lib/auth-rules";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  // Links emailed before the flag was turned off must not log anyone in either.
  if (!env.MAGIC_LINK_LOGIN) {
    return NextResponse.redirect(new URL("/login?error=disabled", origin));
  }
  if (!code) return NextResponse.redirect(new URL("/login?error=callback", origin));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=callback", origin));

  if (!isEmailAllowed(data.user.email, env.ALLOWED_EMAILS)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_allowed", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
