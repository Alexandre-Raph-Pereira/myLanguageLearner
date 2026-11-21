/* `pnpm db:migrate`: apply db/migrations to DATABASE_URL (postgres:// or dev-only pglite://). */
import path from "node:path";
import { openScriptDb } from "./script-client";

const migrationsFolder = path.resolve(__dirname, "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, kind, close } = await openScriptDb(url);
  if (kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder });
  }
  await close();
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
