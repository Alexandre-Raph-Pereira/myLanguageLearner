/* Recreates + seeds the e2e PGlite database (run by playwright.config.ts before `next dev`). */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { seedGrammar } from "@/db/seed-grammar";
import { seedProgress } from "@/db/seed-progress";
import { seedWords } from "@/db/seed-words";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { ensureUserRows } from "@/lib/user-bootstrap";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("pglite://")) throw new Error("e2e expects a pglite:// DATABASE_URL");
  const dir = path.resolve(url.slice("pglite://".length));
  if (!path.basename(dir).startsWith(".pglite")) throw new Error(`Refusing to reset ${dir}`);
  fs.rmSync(dir, { recursive: true, force: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../db/migrations") });
  // 30 days of seeded progress (streak 12, ≈ 18,700 pts, 85 % today) + ~40 Korean words + 3 grammar lessons.
  const userId = process.env.DEV_USER_ID;
  if (userId) {
    await ensureUserRows(db as unknown as Db, userId);
    await seedProgress(db as unknown as Db, userId);
    await seedWords(db as unknown as Db, userId);
    await seedGrammar(db as unknown as Db, userId);
  }
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
