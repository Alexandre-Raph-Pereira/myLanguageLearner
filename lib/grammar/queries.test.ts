import { beforeEach, describe, expect, it } from "vitest";
import { recordActivity } from "@/lib/progress/record";
import type { Db } from "@/db/types";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import {
  compactListForPrompt,
  createGrammar,
  creditedLessonIds,
  deleteGrammar,
  findDuplicateLessons,
  getGrammar,
  libraryIndex,
  listGrammar,
  updateGrammar,
} from "./queries";
import { grammarInput, type GrammarInputRaw } from "./schema";

const me = { userId: TEST_USER_ID, language: "ko" as const };
const other = { userId: OTHER_USER_ID, language: "ko" as const };

const lesson = (pattern: string, extra: Partial<GrammarInputRaw> = {}) =>
  grammarInput.parse({
    title: pattern,
    pattern,
    variants: [],
    meaning_short: `meaning of ${pattern}`,
    level: 2,
    description_md: "desc",
    formation_md: "form",
    examples: [
      { sentence: "예문 하나", translation: "one" },
      { sentence: "예문 둘", translation: "two" },
    ],
    similar_md: "",
    related: [],
    ...extra,
  });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("grammar CRUD", () => {
  it("creates with match keys, reads, updates and deletes, scoped by user", async () => {
    const g = await createGrammar(
      db,
      me,
      lesson("-(으)ㄹ 수 있다", { variants: ["-ㄹ 수 있다", "-을 수 있다"] }),
      "import_text",
    );
    expect(g.matchKeys).toEqual(["(으)ㄹ수있다", "ㄹ수있다", "을수있다"]);
    expect(g.source).toBe("import_text");
    expect(await getGrammar(db, other, g.id)).toBeNull();
    expect(await getGrammar(db, { ...me, language: "fr" }, g.id)).toBeNull();

    const up = await updateGrammar(db, me, g.id, lesson("-(으)ㄹ 수 있다", { level: 3 }));
    expect(up?.level).toBe(3);
    expect(up?.matchKeys).toEqual(["(으)ㄹ수있다"]);
    expect(await updateGrammar(db, other, g.id, lesson("x"))).toBeNull();

    expect(await deleteGrammar(db, other, g.id)).toBe(false);
    expect(await deleteGrammar(db, me, g.id)).toBe(true);
    expect(await getGrammar(db, me, g.id)).toBeNull();
  });

  it("writes links in both directions and replaces them on update", async () => {
    const a = await createGrammar(db, me, lesson("-아/어서"));
    const b = await createGrammar(db, me, lesson("-니까"));
    const foreign = await createGrammar(db, other, lesson("-고"));
    const c = await createGrammar(
      db,
      me,
      lesson("-기 때문에", {
        related: [
          { id: a.id, kind: "similar", note: "both give a reason" },
          { id: b.id, kind: "contrast" },
          { id: foreign.id, kind: "similar" },
        ],
      }),
    );
    const got = await getGrammar(db, me, c.id);
    expect(got?.links.map((l) => [l.title, l.kind, l.note])).toEqual([
      ["-니까", "contrast", null],
      ["-아/어서", "similar", "both give a reason"],
    ]);
    expect((await getGrammar(db, me, a.id))?.links.map((l) => l.id)).toEqual([c.id]);
    expect((await getGrammar(db, other, foreign.id))?.links).toEqual([]);

    await updateGrammar(
      db,
      me,
      c.id,
      lesson("-기 때문에", { related: [{ id: b.id, kind: "similar" }] }),
    );
    expect((await getGrammar(db, me, a.id))?.links).toEqual([]);
    expect((await getGrammar(db, me, b.id))?.links.map((l) => [l.id, l.kind])).toEqual([
      [c.id, "similar"],
    ]);

    // Deleting a lesson removes its links (cascade).
    await deleteGrammar(db, me, b.id);
    expect((await getGrammar(db, me, c.id))?.links).toEqual([]);
  });
});

describe("duplicates", () => {
  it("detects lessons sharing a normalized pattern or variant", async () => {
    const a = await createGrammar(
      db,
      me,
      lesson("-(으)ㄹ 수 있다", { variants: ["-ㄹ 수 있다", "-을 수 있다"] }),
    );
    await createGrammar(db, other, lesson("-을 수 있다"));
    const hits = await findDuplicateLessons(db, me, { pattern: "~을수 있다", variants: [] });
    expect(hits.map((h) => h.id)).toEqual([a.id]);
    expect(
      await findDuplicateLessons(db, me, { pattern: "-을 수 있다", variants: [] }, a.id),
    ).toEqual([]);
    expect(await findDuplicateLessons(db, me, { pattern: "-고", variants: [] })).toEqual([]);
  });
});

describe("lists", () => {
  it("searches title / pattern / meaning / variants and filters by level", async () => {
    await createGrammar(
      db,
      me,
      lesson("-아/어서", { meaning_short: "because, and then", level: 1 }),
    );
    await createGrammar(db, me, lesson("-(으)ㄹ 수 있다", { variants: ["-을 수 있다"], level: 2 }));
    await createGrammar(db, other, lesson("-아/어서"));
    expect((await listGrammar(db, me)).length).toBe(2);
    expect((await listGrammar(db, me, { q: "because" })).map((r) => r.pattern)).toEqual([
      "-아/어서",
    ]);
    expect((await listGrammar(db, me, { q: "을 수" })).map((r) => r.pattern)).toEqual([
      "-(으)ㄹ 수 있다",
    ]);
    expect((await listGrammar(db, me, { q: "을수있" })).length).toBe(1);
    expect((await listGrammar(db, me, { level: 1 })).map((r) => r.pattern)).toEqual(["-아/어서"]);
    expect(await listGrammar(db, me, { q: "100%" })).toEqual([]);
  });

  it("builds stable G-codes oldest first and a library index", async () => {
    const a = await createGrammar(db, me, lesson("-아/어서"));
    const b = await createGrammar(db, me, lesson("-니까"));
    const list = await compactListForPrompt(db, me);
    expect(list.map((l) => [l.code, l.id])).toEqual([
      ["G1", a.id],
      ["G2", b.id],
    ]);
    const idx = await libraryIndex(db, me);
    expect(idx.map((e) => e.pattern).sort()).toEqual(["-니까", "-아/어서"]);
    expect(idx[0].examples).toHaveLength(2);
    expect(await compactListForPrompt(db, other)).toEqual([]);
  });

  it("lists lessons credited today", async () => {
    const a = await createGrammar(db, me, lesson("-아/어서"));
    const now = new Date("2026-11-23T10:00:00Z");
    const r = await recordActivity(db, {
      ...me,
      now,
      events: [
        { kind: "grammar_credit", ref_id: a.id, dedupe_key: `grammar_credit:${a.id}:2026-11-23` },
      ],
    });
    expect([...(await creditedLessonIds(db, me, r.localDate))]).toEqual([a.id]);
    expect((await creditedLessonIds(db, me, "2026-11-22")).size).toBe(0);
  });
});
