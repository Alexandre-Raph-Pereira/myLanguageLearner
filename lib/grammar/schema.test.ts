import { describe, expect, it } from "vitest";
import { grammarDraftSchema, grammarInput } from "./schema";

const base = {
  title: " -아/어서 ",
  pattern: "-아/어서",
  variants: ["-아서", "-어서", "-아서", " "],
  meaning_short: "because / and then",
  level: 2,
  description_md: "  Cause **or** sequence.\n\nSecond paragraph.  ",
  formation_md: "",
  examples: [
    { sentence: "배가 고파서 밥을 먹었어요.", translation: "I was hungry so I ate." },
    { sentence: " ", translation: "" },
    { sentence: "학교에 가서 공부해요.", translation: "I go to school and study." },
  ],
  similar_md: "",
  related: [],
};

describe("grammarInput", () => {
  it("cleans fields, dedupes variants and drops empty examples", () => {
    const v = grammarInput.parse(base);
    expect(v.title).toBe("-아/어서");
    expect(v.variants).toEqual(["-아서", "-어서"]);
    expect(v.description_md).toBe("Cause **or** sequence.\n\nSecond paragraph.");
    expect(v.examples).toHaveLength(2);
  });

  it("requires title, pattern, meaning and 2 examples", () => {
    const r = grammarInput.safeParse({
      ...base,
      title: " ",
      examples: [{ sentence: "하나", translation: "one" }],
    });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toContain("Title is required");
    expect(messages).toContain("Add at least 2 examples");
  });

  it("normalizes NFD Korean to NFC", () => {
    const v = grammarInput.parse({ ...base, pattern: "-아/어서".normalize("NFD") });
    expect(v.pattern).toBe("-아/어서".normalize("NFC"));
  });

  it("accepts an empty level and rejects out-of-range levels", () => {
    expect(grammarInput.parse({ ...base, level: null }).level).toBeNull();
    expect(grammarInput.safeParse({ ...base, level: 7 }).success).toBe(false);
  });
});

describe("grammarDraftSchema", () => {
  it("accepts an AI draft with related codes", () => {
    const d = grammarDraftSchema.parse({ ...base, related: [{ ref: "G1", kind: "similar" }] });
    expect(d.related[0]).toEqual({ ref: "G1", kind: "similar" });
  });
});
