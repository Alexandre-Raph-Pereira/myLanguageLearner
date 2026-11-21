import "server-only";
import { env } from "@/lib/env";
import * as schema from "./schema";
import type { Db } from "./types";

export type { Db } from "./types";

const globalForDb = globalThis as unknown as { __dbPromise?: Promise<Db> };

/** Dev/e2e only: `DATABASE_URL=pglite://<dir>` uses an embedded PGlite database. */
export function pgliteDir(url: string): string | null {
  return url.startsWith("pglite://") ? url.slice("pglite://".length) || "./.pglite" : null;
}

async function createDb(): Promise<Db> {
  const url = env.DATABASE_URL;
  const dir = pgliteDir(url);
  if (dir) {
    if (process.env.NODE_ENV === "production") throw new Error("PGlite is dev-only");
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    return drizzle(new PGlite(dir), { schema }) as unknown as Db;
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // prepare: false is required by the Supabase transaction pooler.
  const client = postgres(url, { prepare: false, max: 5 });
  return drizzle(client, { schema }) as unknown as Db;
}

/** Lazily connected client: importing this module never reads DATABASE_URL. */
export function getDb(): Promise<Db> {
  globalForDb.__dbPromise ??= createDb().catch((e) => {
    globalForDb.__dbPromise = undefined;
    throw e;
  });
  return globalForDb.__dbPromise;
}
