import { describe, expect, it } from "vitest";
import { draftForRewrite, normalizeDraft, resolveRelated, toReviewDraft } from "./drafts";
import type { GrammarDraft } from "./schema";

const lessons = [
  { code: "G1", id: "11111111-1111-4111-8111-111111111111", title: "-아/어서" },
  { code: "G2", id: "22222222-2222-4222-8222-222222222222", title: "-니까" },
];

const draft: GrammarDraft = {
  title: " -고 싶다".normalize("NFD"),
  pattern: "",
  variants: ["-고 싶다", " -고 싶다 ", "", "-고 싶어요"],
  meaning_short: " to want ",
  level: 9,
  description_md: " desc ",
  formation_md: "form",
  examples: [
    { sentence: " 가고 싶어요 ", translation: "I want to go" },
    { sentence: "", translation: "dropped" },
  ],
  similar_md: "",
  related: [
    { ref: "g2", kind: "contrast", note: " note " },
    { ref: "G2", kind: "similar" },
    { ref: "G7", kind: "similar" },
  ],
};

describe("drafts", () => {
  it("normalizes strings, variants, examples and level", () => {
    const { related: _r, ...rest } = draft;
    void _r;
    const d = normalizeDraft(rest);
    expect(d.title).toBe("-고 싶다");
    expect(d.title).toBe(d.title.normalize("NFC"));
    expect(d.pattern).toBe("-고 싶다");
    expect(d.variants).toEqual(["-고 싶다", "-고 싶어요"]);
    expect(d.level).toBeNull();
    expect(d.examples).toEqual([{ sentence: "가고 싶어요", translation: "I want to go" }]);
  });

  it("resolves related codes, dropping unknown codes and duplicates", () => {
    expect(resolveRelated(draft.related, lessons)).toEqual([
      { id: lessons[1].id, title: "-니까", kind: "contrast", note: "note" },
    ]);
    expect(toReviewDraft(draft, []).related).toEqual([]);
  });

  it("sends related lessons to the rewrite prompt by title", () => {
    const review = toReviewDraft(draft, lessons);
    const json = JSON.parse(draftForRewrite(review));
    expect(json.related).toEqual([{ ref: "-니까", kind: "contrast", note: "note" }]);
    expect(json.title).toBe("-고 싶다");
  });
});
