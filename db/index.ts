import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";
import type { Db } from "./types";

export type { Db } from "./types";

const globalForDb = globalThis as unknown as { __db?: Db };

function createDb(): Db {
  // prepare: false is required by the Supabase transaction pooler.
  const client = postgres(env.DATABASE_URL, { prepare: false, max: 5 });
  return drizzle(client, { schema }) as unknown as Db;
}

/** Lazily connected client: importing this module never reads DATABASE_URL. */
export function getDb(): Db {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
