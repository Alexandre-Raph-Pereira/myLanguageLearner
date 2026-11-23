import { describe, expect, it } from "vitest";
import { readLessonFiles } from "@/db/import-grammar";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { importLessonFiles } from "./import-files";
import { getGrammar } from "./queries";

const s = { userId: TEST_USER_ID, language: "ko" as const };
const lessons = readLessonFiles().get("ko")!;

describe("importLessonFiles", () => {
  it("creates every lesson once, links related lessons, reports missing ones", async () => {
    const db = await createTestDb();
    const r1 = await importLessonFiles(db, s, lessons);
    expect(r1.created).toHaveLength(lessons.length);
    expect(r1.linksAdded).toBeGreaterThan(0);
    expect(r1.unresolved).toContain("-도록 → -기 위해서");

    const r2 = await importLessonFiles(db, s, lessons);
    expect(r2.created).toEqual([]);
    expect(r2.skipped).toHaveLength(lessons.length);
    expect(r2.linksAdded).toBe(0);

    const all = await db.query.grammarPoints.findMany();
    expect(all).toHaveLength(lessons.length);
    expect(all.every((l) => l.source === "import_text")).toBe(true);

    const irado = all.find((l) => l.pattern === "-(이)라도")!;
    const full = await getGrammar(db, s, irado.id);
    expect(full!.links.map((l) => l.title).sort()).toEqual(["-더라도", "-아/어도"]);
    expect(irado.examples[0]).toEqual({
      sentence: "시간이 없으면 커피라도 마셔요.",
      translation: "If you don't have time, at least have a coffee.",
    });
    expect(
      await db.query.grammarPoints.findMany({ where: (g, { eq }) => eq(g.userId, OTHER_USER_ID) }),
    ).toEqual([]);
  });

  it("--update overwrites the lesson text and keeps its links", async () => {
    const db = await createTestDb();
    await importLessonFiles(db, s, lessons);
    const edited = lessons.map((l) =>
      l.pattern === "-(이)라도" ? { ...l, meaningShort: "at least", related: [] } : l,
    );
    const r = await importLessonFiles(db, s, edited, { update: true });
    expect(r.updated).toHaveLength(lessons.length);
    const irado = (await db.query.grammarPoints.findMany()).find((l) => l.pattern === "-(이)라도")!;
    expect(irado.meaningShort).toBe("at least");
    expect((await getGrammar(db, s, irado.id))!.links).toHaveLength(2);
  });
});
