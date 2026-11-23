import { describe, expect, it } from "vitest";
import { highlight, highlightCandidates } from "./highlight";

const marked = (sentence: string, patterns: string[]) =>
  highlight(sentence, patterns)
    .filter((s) => s.match)
    .map((s) => s.text);

describe("highlightCandidates", () => {
  it("expands optional parts, drops leading jamo and the dictionary 다", () => {
    const c = highlightCandidates(["-(으)ㄹ 수 있다"]);
    expect(c).toContain("수 있다");
    expect(c).toContain("수 있");
    expect(c).not.toContain("ㄹ 수 있다");
  });

  it("skips slash alternatives (variants list the surface forms)", () => {
    expect(highlightCandidates(["-아/어서"])).toEqual([]);
    expect(highlightCandidates(["-아/어서", "-아서", "-어서"]).sort()).toEqual(["아서", "어서"]);
  });
});

describe("highlight", () => {
  it("marks conjugated occurrences", () => {
    expect(marked("저는 한국어를 할 수 있어요.", ["-(으)ㄹ 수 있다", "-을 수 있다"])).toEqual([
      "수 있",
    ]);
    expect(marked("배가 고파서 밥을 먹었어요.", ["-아/어서", "-아서", "-어서"])).toEqual([]);
    expect(marked("학교에 가서 공부해요.", ["-아서", "-어서", "-서"])).toEqual(["서"]);
    expect(marked("집에 와서 쉬었어요.", ["-아서", "-어서", "-서"])).toEqual(["서"]);
  });

  it("keeps the whole sentence and every match", () => {
    const segs = highlight("먹고 자고", ["-고"]);
    expect(segs.map((s) => s.text).join("")).toBe("먹고 자고");
    expect(segs.filter((s) => s.match)).toHaveLength(2);
  });

  it("returns one plain segment without candidates", () => {
    expect(highlight("안녕하세요", [])).toEqual([{ text: "안녕하세요", match: false }]);
  });
});
