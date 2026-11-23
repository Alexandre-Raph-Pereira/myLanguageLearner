import { describe, expect, it } from "vitest";
import { clean, cleanOrNull, meaningKey, normEn, normKo } from "./normalize";

describe("clean", () => {
  it("NFC-normalizes, trims and collapses spaces", () => {
    const nfd = "  공부   하다 ".normalize("NFD");
    expect(clean(nfd)).toBe("공부 하다");
    expect(clean(nfd)).toBe("공부 하다".normalize("NFC"));
  });
  it("cleanOrNull returns null for empty", () => {
    expect(cleanOrNull("  ")).toBeNull();
    expect(cleanOrNull(null)).toBeNull();
    expect(cleanOrNull(undefined)).toBeNull();
    expect(cleanOrNull(" a ")).toBe("a");
  });
});

describe("normKo", () => {
  it("equates NFD and NFC Hangul", () => {
    expect(normKo("한국어".normalize("NFD"))).toBe(normKo("한국어"));
  });
  it("removes all whitespace", () => {
    expect(normKo("공부 하다")).toBe("공부하다");
    expect(normKo(" 공부\t하다 ")).toBe("공부하다");
  });
  it("strips trailing punctuation and quotes", () => {
    expect(normKo("먹어요.")).toBe("먹어요");
    expect(normKo("뭐예요?!")).toBe("뭐예요");
    expect(normKo("안녕~")).toBe("안녕");
    expect(normKo('"사과"')).toBe("사과");
    expect(normKo("‘사과.’")).toBe("사과");
  });
});

describe("normEn", () => {
  it("lowercases, strips punctuation, keeps apostrophes and hyphens", () => {
    expect(normEn("  Hello,   World! ")).toBe("hello world");
    expect(normEn("Don’t")).toBe("don't");
    expect(normEn("well-known")).toBe("well-known");
  });
  it("strips leading 'to' and articles", () => {
    expect(normEn("to eat")).toBe("eat");
    expect(normEn("To Eat")).toBe("eat");
    expect(normEn("The book")).toBe("book");
    expect(normEn("an apple")).toBe("apple");
    expect(normEn("a")).toBe("a");
    expect(normEn("today")).toBe("today");
    expect(normEn("theory")).toBe("theory");
  });
  it("meaningKey = normEn", () => {
    expect(meaningKey("The Pear.")).toBe("pear");
  });
});
