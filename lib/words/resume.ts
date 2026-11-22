import "server-only";
import type { ResumeInfo } from "@/components/tests/test-card";
import { getWordContext } from "./context";
import { latestOpenSession } from "./session";

/** Resume card data for the latest unfinished word test, or null. */
export async function wordResumeInfo(): Promise<ResumeInfo | null> {
  const { db, scope } = await getWordContext();
  const open = await latestOpenSession(db, scope);
  if (!open) return null;
  return {
    href: `/tests/words/${open.id}`,
    title: "Word test",
    sub: `${open.answered} / ${open.total} answered`,
  };
}
