import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";

/** Fresh in-memory Postgres (PGlite) with all migrations applied. */
export async function createTestDb(): Promise<Db & { $client: PGlite }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../db/migrations") });
  return db as unknown as Db & { $client: PGlite };
}

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
export const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
