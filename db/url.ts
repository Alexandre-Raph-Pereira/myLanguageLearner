/**
 * Normalizes a Postgres URL for the `postgres` (postgres.js) driver.
 *
 * postgres.js forwards unknown query params as server startup parameters, so
 * provider-specific params found in Supabase/Vercel URLs (`supa=base-pooler.x`,
 * `pgbouncer=true`, …) make the server reject the connection. Only params the
 * driver understands are kept. Remote hosts default to SSL `require`.
 */

const KEPT_PARAMS = new Set([
  "sslmode",
  "ssl",
  "connect_timeout",
  "application_name",
  "options",
  "target_session_attrs",
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type PostgresJsConfig = { url: string; ssl?: "require" };

export function toPostgresJsConfig(raw: string): PostgresJsConfig {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (!KEPT_PARAMS.has(key)) url.searchParams.delete(key);
  }
  const hasSsl = url.searchParams.has("sslmode") || url.searchParams.has("ssl");
  const local = LOCAL_HOSTS.has(url.hostname);
  return { url: url.toString(), ...(!hasSsl && !local ? { ssl: "require" as const } : {}) };
}

/** URL with the password masked, safe to print in logs. */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}
