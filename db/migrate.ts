/* `pnpm db:migrate`: apply db/migrations to DATABASE_URL (postgres:// or dev-only pglite://). */
import path from "node:path";
import { openScriptDb } from "./script-client";
import { redactUrl } from "./url";

const migrationsFolder = path.resolve(__dirname, "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  console.log(`Migrating ${redactUrl(url)}`);
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

/** Drizzle wraps driver errors as "Failed query: …"; the real reason is in `cause`. */
function describe(e: unknown): string {
  const lines: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (cur instanceof Error) {
      const code = (cur as { code?: string }).code;
      lines.push(
        `${depth === 0 ? "Error" : "Caused by"}: ${cur.message.split("\n")[0]}${code ? ` [${code}]` : ""}`,
      );
      cur = cur.cause;
    } else {
      lines.push(`Caused by: ${String(cur)}`);
      break;
    }
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error(describe(e));
  process.exit(1);
});
