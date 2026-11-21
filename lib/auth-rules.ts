/** Pure auth rules shared by proxy.ts, the login action and the callback. */

const PUBLIC_PREFIXES = ["/login", "/auth", "/_next", "/icons"];
const PUBLIC_FILES = new Set([
  "/manifest.webmanifest",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/robots.txt",
]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isEmailAllowed(email: string | null | undefined, allowed: readonly string[]) {
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/** Only allow same-site relative redirects after login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
