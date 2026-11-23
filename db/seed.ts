/* Dev-only seed: `pnpm db:seed` (uses DATABASE_URL and DEV_USER_ID). */
import { openScriptDb } from "./script-client";
import * as schema from "./schema";
import { seedGrammar } from "./seed-grammar";
import { seedProgress } from "./seed-progress";
import { seedWords } from "./seed-words";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("db:seed is dev only");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const userId = process.env.DEV_USER_ID ?? "00000000-0000-4000-8000-000000000001";
  const { db, close } = await openScriptDb(url);
  await db.insert(schema.userSettings).values({ userId }).onConflictDoNothing();
  await db
    .insert(schema.languageProfiles)
    .values({ userId, language: "ko", exam: "TOPIK", targetLevel: 3 })
    .onConflictDoNothing();
  await db
    .insert(schema.modelPricing)
    .values({
      modelId: "claude-sonnet-5-5",
      inputPerMtok: 2,
      outputPerMtok: 10,
      cacheReadPerMtok: 0.1,
    })
    .onConflictDoNothing();
  const progress = await seedProgress(db, userId);
  const added = await seedWords(db, userId);
  const lessons = await seedGrammar(db, userId);
  console.log(
    `Seeded dev user ${userId}: ${progress.pointsTotal.toLocaleString("en-US")} pts, streak ${progress.streak}, ${added} new words, ${lessons} new grammar lessons`,
  );
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
