import { describe, expect, it } from "vitest";
import { findPossibleDuplicates, matchKeys, normPattern } from "./normalize";

describe("normPattern", () => {
  it("removes spaces and leading dashes / tildes, NFC, lowercases Latin", () => {
    expect(normPattern(" -(으)ㄹ 수 있다 ")).toBe("(으)ㄹ수있다");
    expect(normPattern("~아/어서")).toBe("아/어서");
    expect(normPattern("–는데")).toBe("는데");
    expect(normPattern("—는데")).toBe("는데");
    expect(normPattern("～고 싶다")).toBe("고싶다");
    expect(normPattern("Ne ... Pas")).toBe("ne...pas");
  });

  it("composes decomposed Hangul (NFD → NFC)", () => {
    const nfd = "-을 수 있다".normalize("NFD");
    expect(normPattern(nfd)).toBe(normPattern("-을 수 있다"));
  });
});

describe("matchKeys", () => {
  it("dedupes pattern + variants and drops empty keys", () => {
    expect(
      matchKeys({
        pattern: "-(으)ㄹ 수 있다",
        variants: ["-ㄹ 수 있다", "ㄹ수 있다", "-을 수 있다", " ", "~을 수 없다"],
      }),
    ).toEqual(["(으)ㄹ수있다", "ㄹ수있다", "을수있다", "을수없다"]);
  });
});

describe("findPossibleDuplicates", () => {
  const existing = [
    { id: "a", title: "-(으)ㄹ 수 있다", matchKeys: ["(으)ㄹ수있다", "ㄹ수있다", "을수있다"] },
    { id: "b", title: "-아/어서", matchKeys: ["아/어서", "아서", "어서"] },
  ];

  it("finds lessons sharing any key", () => {
    expect(
      findPossibleDuplicates({ pattern: "-을 수 있다", variants: [] }, existing).map((e) => e.id),
    ).toEqual(["a"]);
    expect(
      findPossibleDuplicates({ pattern: "-고", variants: ["어서"] }, existing).map((e) => e.id),
    ).toEqual(["b"]);
    expect(findPossibleDuplicates({ pattern: "-고", variants: [] }, existing)).toEqual([]);
  });

  it("excludes the lesson being edited and empty drafts", () => {
    expect(findPossibleDuplicates({ pattern: "-아서", variants: [] }, existing, "b")).toEqual([]);
    expect(findPossibleDuplicates({ pattern: " ", variants: [] }, existing)).toEqual([]);
  });
});
