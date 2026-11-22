import { describe, expect, it } from "vitest";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { countWords, seedWords } from "./seed-words";
import { SEED_WORDS } from "./seed-words-data";

describe("seedWords", () => {
  it("inserts ~40 words once (idempotent)", async () => {
    const db = await createTestDb();
    expect(await seedWords(db, TEST_USER_ID)).toBe(SEED_WORDS.length);
    expect(await seedWords(db, TEST_USER_ID)).toBe(0);
    expect(await countWords(db, TEST_USER_ID)).toBe(SEED_WORDS.length);
    expect(SEED_WORDS.length).toBeGreaterThanOrEqual(40);
  });

});
