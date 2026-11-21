import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth-rules";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Dev-only bypass (never in production): act as DEV_USER_ID without Supabase.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) {
    return NextResponse.next({ request });
  }

  const { response, user } = await updateSession(request);
  if (user || isPublicPath(pathname)) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Everything except static assets and PWA files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|apple-touch-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
