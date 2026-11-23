import "server-only";
import { getDb } from "@/db";
import type { Db } from "@/db/types";
import { requireUser, type AuthUser } from "@/lib/auth";
import { isLanguage } from "@/lib/languages";
import { getUserSettings } from "@/lib/settings";
import type { UserSettings } from "@/db/schema";
import type { Scope } from "./queries";

export type WordContext = { db: Db; user: AuthUser; scope: Scope; settings: UserSettings };

/**
 * Signed-in user + active language scope for words pages and actions.
 * Pass `{ throwOnMissing: true }` from server actions / route handlers.
 */
export async function getWordContext(
  opts: { throwOnMissing?: boolean } = {},
): Promise<WordContext> {
  const user = await requireUser(opts);
  const db = await getDb();
  const settings = await getUserSettings(db, user.id);
  const language = isLanguage(settings.activeLanguage) ? settings.activeLanguage : "ko";
  return { db, user, scope: { userId: user.id, language }, settings };
}
