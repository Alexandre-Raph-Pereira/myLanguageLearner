import { beforeEach, describe, expect, it } from "vitest";
import { aiUsage, modelPricing, userSettings } from "@/db/schema";
import type { Db } from "@/db/types";
import { getMockCalls, resetMockFixtures } from "@/lib/ai/mock";
import { createTestDb, TEST_USER_ID } from "@/tests/db";
import { grammarCostInfo, rewriteGrammar, structureGrammar } from "./ai";
import { structureEstimate } from "./cost";
import { createGrammar } from "./queries";
import { grammarInput } from "./schema";

const me = { userId: TEST_USER_ID, language: "ko" as const };
let db: Db;

const lesson = (pattern: string) =>
  grammarInput.parse({
    title: pattern,
    pattern,
    variants: [],
    meaning_short: `m ${pattern}`,
    examples: [
      { sentence: "가", translation: "a" },
      { sentence: "나", translation: "b" },
    ],
  });

beforeEach(async () => {
  resetMockFixtures();
  db = await createTestDb();
  await db.insert(userSettings).values({ userId: TEST_USER_ID });
});

describe("structureGrammar", () => {
  it("returns drafts with related codes mapped to the user's lessons", async () => {
    const g1 = await createGrammar(db, me, lesson("-아/어서"));
    const drafts = await structureGrammar(db, me, { notes: "-고 싶다 = want to\n-지만 = but" });
    expect(drafts.map((d) => d.title)).toEqual(["-고 싶다", "-지만"]);
    expect(drafts[0].related).toEqual([
      { id: g1.id, title: "-아/어서", kind: "similar", note: "both attach to verb stems" },
    ]);
    const [call] = getMockCalls("grammar.structure");
    const sent = JSON.stringify(call.prompt);
    expect(sent).toContain("G1: -아/어서");
    expect(sent).toContain("-고 싶다 = want to");
    const usage = await db.select().from(aiUsage);
    expect(usage[0]).toMatchObject({ task: "grammar.structure", status: "ok" });
  });

  it("sends a photo to the model", async () => {
    await structureGrammar(db, me, {
      image: { data: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" },
    });
    const [call] = getMockCalls("grammar.structure");
    expect(JSON.stringify(call.prompt)).toContain("image/jpeg");
    expect(JSON.stringify(call.prompt)).toContain("no lessons yet");
  });
});

describe("rewriteGrammar", () => {
  it("replaces the fields from the model and keeps the user's related lessons", async () => {
    const related = [
      { id: "11111111-1111-4111-8111-111111111111", title: "-니까", kind: "contrast" as const },
    ];
    const out = await rewriteGrammar(
      db,
      me,
      {
        title: "-지만",
        pattern: "-지만",
        variants: [],
        meaning_short: "but",
        level: 1,
        description_md: "long description",
        formation_md: "",
        examples: [],
        similar_md: "",
        related,
      },
      "shorter description",
    );
    expect(out.description_md).toBe('Contrasts two clauses ("A, but B").');
    expect(out.related).toEqual(related);
    const sent = JSON.stringify(getMockCalls("grammar.rewrite")[0].prompt);
    expect(sent).toContain("shorter description");
    expect(sent).toContain("long description");
  });
});

describe("grammarCostInfo", () => {
  it("gives rates and prompt sizes for the estimate, null rates without a price", async () => {
    const info = await grammarCostInfo(db, me);
    expect(info.rates).not.toBeNull();
    expect(info.structureBaseTokens).toBeGreaterThan(100);
    expect(structureEstimate(info, { notes: "abc" })).toBeGreaterThan(0);
    await db.delete(modelPricing);
    expect((await grammarCostInfo(db, me)).rates).toBeNull();
  });
});
