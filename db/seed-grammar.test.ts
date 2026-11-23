import { describe, expect, it } from "vitest";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { getGrammar, listGrammar } from "@/lib/grammar/queries";
import { seedGrammar } from "./seed-grammar";

describe("seedGrammar", () => {
  it("inserts 3 linked lessons once", async () => {
    const db = await createTestDb();
    expect(await seedGrammar(db, TEST_USER_ID)).toBe(3);
    expect(await seedGrammar(db, TEST_USER_ID)).toBe(0);
    const s = { userId: TEST_USER_ID, language: "ko" as const };
    const rows = await listGrammar(db, s);
    expect(rows).toHaveLength(3);
    const a = rows.find((r) => r.title === "-아/어서")!;
    expect((await getGrammar(db, s, a.id))?.links.map((l) => l.title)).toEqual(["-(으)니까"]);
  });
});
