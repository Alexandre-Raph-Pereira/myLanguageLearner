/* Recreates the e2e PGlite database (run by playwright.config.ts before `next dev`). */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("pglite://")) throw new Error("e2e expects a pglite:// DATABASE_URL");
  const dir = path.resolve(url.slice("pglite://".length));
  if (!path.basename(dir).startsWith(".pglite")) throw new Error(`Refusing to reset ${dir}`);
  fs.rmSync(dir, { recursive: true, force: true });
  const client = new PGlite(dir);
  await migrate(drizzle(client), { migrationsFolder: path.resolve(__dirname, "../db/migrations") });
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
