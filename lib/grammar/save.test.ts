import { beforeEach, describe, expect, it } from "vitest";
import { userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { createTestDb, OTHER_USER_ID, TEST_USER_ID } from "@/tests/db";
import { todayFor } from "./credit";
import { creditedLessonIds, getGrammar } from "./queries";
import { saveDraft } from "./save";
import { emptyDraft, type ReviewDraft } from "./schema";

const me = { userId: TEST_USER_ID, language: "ko" as const };
let db: Db;

const draft = (title: string, extra: Partial<ReviewDraft> = {}): ReviewDraft => ({
  ...emptyDraft(),
  title,
  pattern: title,
  meaning_short: `m ${title}`,
  examples: [
    { sentence: "하나", translation: "one" },
    { sentence: "둘", translation: "two" },
  ],
  ...extra,
});

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

describe("saveDraft", () => {
  it("creates a lesson with its source and credits it for today", async () => {
    const r = await saveDraft(db, me, { draft: draft("-지만"), source: "import_text" });
    expect(r).toMatchObject({ status: "saved", title: "-지만", created: true });
    if (r.status !== "saved") throw new Error();
    expect((await getGrammar(db, me, r.id))?.source).toBe("import_text");
    const today = await todayFor(db, me.userId);
    expect((await creditedLessonIds(db, me, today)).has(r.id)).toBe(true);
  });

  it("returns field errors for invalid drafts", async () => {
    const r = await saveDraft(db, me, {
      draft: draft("", { examples: [] }),
      source: "manual",
    });
    expect(r.status).toBe("invalid");
    if (r.status !== "invalid") throw new Error();
    expect(r.errors.title).toBe("Title is required");
    expect(r.errors.examples).toBe("Add at least 2 examples");
  });

  it("blocks possible duplicates unless allowed, and saves links", async () => {
    const first = await saveDraft(db, me, {
      draft: draft("-(으)ㄹ 수 있다", { variants: ["-을 수 있다"] }),
      source: "manual",
    });
    if (first.status !== "saved") throw new Error();
    const dup = await saveDraft(db, me, { draft: draft("~을 수 있다"), source: "manual" });
    expect(dup).toEqual({
      status: "duplicate",
      duplicates: [{ id: first.id, title: "-(으)ㄹ 수 있다" }],
    });
    const forced = await saveDraft(db, me, {
      draft: draft("~을 수 있다", {
        related: [{ id: first.id, title: "x", kind: "similar" }],
      }),
      source: "manual",
      allowDuplicate: true,
    });
    if (forced.status !== "saved") throw new Error();
    expect((await getGrammar(db, me, first.id))?.links.map((l) => l.id)).toEqual([forced.id]);
  });

  it("updates an existing lesson without flagging itself as a duplicate", async () => {
    const r = await saveDraft(db, me, { draft: draft("-지만"), source: "manual" });
    if (r.status !== "saved") throw new Error();
    const u = await saveDraft(db, me, {
      draft: draft("-지만", { level: 2 }),
      source: "manual",
      lessonId: r.id,
    });
    expect(u).toMatchObject({ status: "saved", created: false });
    expect((await getGrammar(db, me, r.id))?.level).toBe(2);
    const other = await saveDraft(
      db,
      { ...me, userId: OTHER_USER_ID },
      { draft: draft("-지만"), source: "manual", lessonId: r.id },
    );
    expect(other.status).toBe("missing");
  });
});
