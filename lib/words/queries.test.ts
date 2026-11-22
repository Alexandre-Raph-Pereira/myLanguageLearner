import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { words } from "@/db/schema";
import type { Db } from "@/db/types";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { wordInput, wordKey, type WordInput } from "./input";
import {
  bulkInsert,
  createWord,
  deleteWord,
  DuplicateWordError,
  findDuplicates,
  getWord,
  libraryIndex,
  listWords,
  testCandidates,
  updateWord,
  wordStats,
} from "./queries";

const me = { userId: TEST_USER_ID, language: "ko" as const };
const other = { userId: OTHER_USER_ID, language: "ko" as const };

const w = (term: string, meanings: string[], extra: Partial<WordInput> = {}): WordInput =>
  wordInput.parse({ term, meanings, ...extra });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("word CRUD", () => {
  it("creates, reads, updates and deletes, scoped by user", async () => {
    const created = await createWord(db, me, w(" 사과 ", ["apple", "Apple"], { type: "noun" }));
    expect(created).toMatchObject({
      term: "사과",
      meanings: ["apple"],
      meaningKey: "apple",
      level: 0,
      source: "manual",
      status: "active",
    });
    expect(await getWord(db, other, created.id)).toBeNull();
    expect(await getWord(db, { ...me, language: "fr" }, created.id)).toBeNull();

    const updated = await updateWord(
      db,
      me,
      created.id,
      w("사과", ["apple", "apology"], { exampleSentence: "사과를 먹어요." }),
    );
    expect(updated?.meanings).toEqual(["apple", "apology"]);
    expect(updated?.exampleSentence).toBe("사과를 먹어요.");
    expect(await updateWord(db, other, created.id, w("x", ["y"]))).toBeNull();

    expect(await deleteWord(db, other, created.id)).toBe(false);
    expect(await deleteWord(db, me, created.id)).toBe(true);
    expect(await getWord(db, me, created.id)).toBeNull();
  });

  it("stores Korean as NFC", async () => {
    const nfd = "사과".normalize("NFD");
    const created = await createWord(db, me, w(nfd, ["apple"]));
    expect(created.term).toBe("사과".normalize("NFC"));
  });

  it("allows homonyms but not the same term + primary meaning", async () => {
    await createWord(db, me, w("배", ["pear"]));
    await createWord(db, me, w("배", ["boat"]));
    await createWord(db, me, w("배", ["belly", "stomach"]));
    await expect(createWord(db, me, w("배", ["The pear"]))).rejects.toBeInstanceOf(
      DuplicateWordError,
    );
    // Same word for another user is fine.
    await createWord(db, other, w("배", ["pear"]));
    expect((await listWords(db, me)).total).toBe(3);
  });

  it("rejects invalid input", () => {
    expect(wordInput.safeParse({ term: " ", meanings: ["a"] }).success).toBe(false);
    expect(wordInput.safeParse({ term: "a", meanings: [" ", ""] }).success).toBe(false);
    expect(wordInput.safeParse({ term: "a", meanings: ["b"], type: "bogus" }).success).toBe(false);
  });
});

describe("listWords filters", () => {
  beforeEach(async () => {
    await createWord(db, me, w("먹다", ["to eat"], { type: "verb", exampleSentence: "밥을 먹다" }));
    await createWord(db, me, w("사과", ["apple"], { type: "noun" }));
    await createWord(db, me, w("빨리", ["quickly", "fast"], { type: "adverb" }));
    await createWord(db, other, w("사과", ["apple"]));
    await db.update(words).set({ level: 2 }).where(sqlTerm("먹다"));
  });

  it("searches term and meanings (ILIKE)", async () => {
    expect((await listWords(db, me, { q: "사" })).rows.map((r) => r.term)).toEqual(["사과"]);
    expect((await listWords(db, me, { q: "FAST" })).rows.map((r) => r.term)).toEqual(["빨리"]);
    expect((await listWords(db, me, { q: "%" })).total).toBe(0);
  });

  it("filters by type, level, needsExample and status", async () => {
    expect((await listWords(db, me, { types: ["verb", "noun"] })).total).toBe(2);
    expect((await listWords(db, me, { levels: [2] })).rows[0].term).toBe("먹다");
    expect((await listWords(db, me, { needsExample: true })).total).toBe(2);
    expect((await listWords(db, me, { status: "suggested" })).total).toBe(0);
  });

  it("paginates", async () => {
    const page = await listWords(db, me, {}, { limit: 2, offset: 2 });
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(3);
  });

  it("computes stats", async () => {
    const stats = await wordStats(db, me);
    expect(stats).toMatchObject({
      total: 3,
      byLevel: [2, 0, 1, 0],
      known: 1,
      needsExample: 2,
      due: 3,
    });
    expect(stats.byType).toEqual({ verb: 1, noun: 1, adverb: 1 });
  });

  it("builds the library index and test candidates", async () => {
    expect((await libraryIndex(db, me)).map((e) => e.term)).toEqual(["먹다", "빨리", "사과"]);
    expect(await testCandidates(db, me, { types: ["noun"] })).toHaveLength(1);
    expect(await testCandidates(db, me, { includeNoExample: false })).toHaveLength(1);
  });
});

describe("bulk insert + duplicates", () => {
  it("inserts, skips duplicates (in file and in bank)", async () => {
    await createWord(db, me, w("사과", ["apple"]));
    const res = await bulkInsert(
      db,
      me,
      [w("사과", ["apple"]), w("배", ["pear"]), w("배", ["pear"]), w("배", ["boat"])],
      { source: "import_csv", batchSize: 2 },
    );
    expect(res).toEqual({ inserted: 2, updated: 0, skipped: 2 });
    const all = await listWords(db, me);
    expect(all.total).toBe(3);
    expect(all.rows.find((r) => r.meanings[0] === "boat")?.source).toBe("import_csv");
  });

  it("updates existing example and appends meanings when asked", async () => {
    await createWord(db, me, w("사과", ["apple"], { type: "noun", exampleSentence: "old" }));
    const res = await bulkInsert(
      db,
      me,
      [
        w("사과", ["apple", "apology"], {
          exampleSentence: "사과 주세요",
          exampleTranslation: "x",
        }),
        w("새", ["bird"]),
      ],
      { source: "import_csv", updateExisting: true },
    );
    expect(res).toEqual({ inserted: 1, updated: 1, skipped: 0 });
    const [row] = (await listWords(db, me, { q: "사과" })).rows;
    expect(row).toMatchObject({
      meanings: ["apple", "apology"],
      exampleSentence: "사과 주세요",
      exampleTranslation: "x",
      type: "noun",
    });
  });

  it("imports a Quizlet-sized bank (700 rows) in batches", async () => {
    const rows = Array.from({ length: 700 }, (_, i) => w(`단어${i}`, [`word ${i}`]));
    const res = await bulkInsert(db, me, rows, { source: "import_csv" });
    expect(res).toEqual({ inserted: 700, updated: 0, skipped: 0 });
    const again = await bulkInsert(db, me, rows, { source: "import_csv" });
    expect(again).toEqual({ inserted: 0, updated: 0, skipped: 700 });
    const dups = await findDuplicates(db, me, rows);
    expect(dups.size).toBe(700);
  });

  it("finds duplicates among candidate rows", async () => {
    await createWord(db, me, w("배", ["pear"]));
    const dups = await findDuplicates(db, me, [
      { term: "배", meanings: ["Pear"] },
      { term: "배", meanings: ["boat"] },
      { term: "새", meanings: [] },
    ]);
    expect([...dups]).toEqual([wordKey("배", "pear")]);
  });
});

function sqlTerm(term: string) {
  return eq(words.term, term);
}
