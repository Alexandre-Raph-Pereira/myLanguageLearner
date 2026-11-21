/* Connection helper for CLI scripts (migrate, seed). Not imported by the app. */
import type { Db } from "./types";
import * as schema from "./schema";

export async function openScriptDb(url: string): Promise<{
  db: Db;
  kind: "pglite" | "postgres";
  close: () => Promise<void>;
}> {
  if (url.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(url.slice("pglite://".length) || "./.pglite");
    return {
      db: drizzle(client, { schema }) as unknown as Db,
      kind: "pglite",
      close: () => client.close(),
    };
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(url, { prepare: false, max: 1 });
  return {
    db: drizzle(client, { schema }) as unknown as Db,
    kind: "postgres",
    close: () => client.end(),
  };
}
