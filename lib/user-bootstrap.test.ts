import { describe, expect, it } from "vitest";
import { languageProfiles, userSettings } from "@/db/schema";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { ensureUserRows } from "./user-bootstrap";

describe("ensureUserRows", () => {
  it("creates settings + ko profile once (idempotent)", async () => {
    const db = await createTestDb();
    await ensureUserRows(db, TEST_USER_ID);
    await ensureUserRows(db, TEST_USER_ID);
    expect(await db.select().from(userSettings)).toHaveLength(1);
    const profiles = await db.select().from(languageProfiles);
    expect(profiles).toEqual([
      expect.objectContaining({
        userId: TEST_USER_ID,
        language: "ko",
        exam: "TOPIK",
        targetLevel: null,
      }),
    ]);
  });
});
