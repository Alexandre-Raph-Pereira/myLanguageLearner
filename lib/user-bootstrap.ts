import { languageProfiles, userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { ENABLED_LANGUAGES } from "@/lib/languages";

/** Idempotently creates the settings row and the enabled language profiles. */
export async function ensureUserRows(db: Db, userId: string): Promise<void> {
  await db.insert(userSettings).values({ userId }).onConflictDoNothing();
  await db
    .insert(languageProfiles)
    .values(ENABLED_LANGUAGES.map((language) => ({ userId, language })))
    .onConflictDoNothing();
}
