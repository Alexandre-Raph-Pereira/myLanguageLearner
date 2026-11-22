"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveTimezone, timezoneInput } from "@/lib/settings";

/** Called once by <TimezoneSync> when the browser's zone differs from the stored one. */
export async function syncTimezoneAction(timezone: string): Promise<{ ok: boolean }> {
  const user = await requireUser({ throwOnMissing: true });
  const parsed = timezoneInput.safeParse({ timezone });
  if (!parsed.success) return { ok: false };
  await saveTimezone(await getDb(), user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
